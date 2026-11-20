/**
 * ACESSO — a conta nasce aqui.
 * ============================================================================
 * O Cânone entra por LINK, não por senha: quem assina informa o e-mail,
 * recebe um link de uso único e passa a ter uma sessão. A senha nunca
 * existe no banco (`identity.account.password_hash` fica NULL), o que
 * significa que não há senha para vazar, para ser reutilizada em outro
 * serviço, nem para o suporte pedir por telefone.
 *
 * O TOKEN CRU NÃO VAI PARA O BANCO
 *
 * O banco guarda o HASH do link e da sessão (sha256). O token cru existe
 * só na memória do backend, no instante em que ele é entregue. Se o banco
 * for lido por alguém, não há nada para usar: só hashes.
 *
 * A ENTREGA É DELEGA
 *
 * O banco não manda e-mail. Este serviço devolve o token cru e o backend
 * o entrega pelo canal configurado (hoje: um webhook de e-mail; em
 * desenvolvimento: o console do servidor). O banco fica fora do negócio
 * de e-mail — e a troca de canal não toca o schema.
 *
 * O QUE ESTE SERVIÇO NÃO FAZ
 *
 * Não decide o que a pessoa pode ver. Ele diz QUEM é a pessoa; o que ela
 * pode ver é o banco, no papel da área, com as policies e as regras.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../../db/driver.js';

/** O link de acesso vale 15 minutos. Curto o bastante para não ser usado por terceiro. */
const VALIDADE_LINK_MINUTOS = 15;

/** A sessão vale 30 dias. */
const VALIDADE_SESSAO_DIAS = 30;

export interface PedidoLink {
  /** O token CRU — só existe aqui, e só o backend o entrega. */
  token: string;
  expiraEm: Date;
}

export interface SessaoAberta {
  userId: string;
  /** O token CRU da sessão — o app o guarda como Bearer. */
  token: string;
  expiraEm: Date;
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function novoToken(): string {
  return randomBytes(32).toString('base64url');
}

/** "ana.maria@exemplo.com" → "Ana Maria" (display_name é NOT NULL). */
function nomeDeExibicao(email: string): string {
  const local = email.split('@')[0] ?? 'Visitante';
  const partes = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  return partes.join(' ') || 'Visitante';
}

export const acesso = {
  /**
   * Pede o link de acesso.
   *
   * Não diz se o e-mail existe: a resposta é a mesma nos dois casos, senão
   * a rota vira um oráculo de quem tem conta.
   */
  async pedirLink(db: Db, email: string): Promise<PedidoLink> {
    const token = novoToken();
    const expiraEm = new Date(Date.now() + VALIDADE_LINK_MINUTOS * 60_000);
    await db.query(
      `INSERT INTO canone_identity.magic_link (email, token_hash, purpose, expires_at)
       VALUES ($1, $2, 'login', $3)`,
      [email.trim().toLowerCase(), hash(token), expiraEm]
    );
    return { token, expiraEm };
  },

  /**
   * Troca o link usado pela sessão.
   *
   * O link é de USO ÚNICO: o consumo acontece na transação, e a atualização
   * só vale se ainda não houver consumo (`consumed_at IS NULL`). Duas
   * tentativas simultâneas com o mesmo link: uma vence, a outra é
   * recusada.
   */
  async abrirSessao(db: Db, token: string): Promise<SessaoAberta> {
    const r = await db.query<{
      id: string;
      email: string;
      expires_at: Date;
      consumed_at: Date | null;
    }>(
      `SELECT id, email, expires_at, consumed_at
         FROM canone_identity.magic_link
        WHERE token_hash = $1`,
      [hash(token)]
    );
    const link = r.rows[0];
    if (!link) throw new Error('Link de acesso inválido.');
    if (link.consumed_at) throw new Error('Este link já foi usado. Peça outro.');
    if (new Date(link.expires_at).getTime() < Date.now()) {
      throw new Error('Este link expirou. Peça outro.');
    }

    const consumido = await db.query<{ id: string }>(
      `UPDATE canone_identity.magic_link SET consumed_at = now()
        WHERE id = $1 AND consumed_at IS NULL
        RETURNING id`,
      [link.id]
    );
    if (!consumido.rows[0]) throw new Error('Este link já foi usado. Peça outro.');

    const userId = await this.assegurarConta(db, link.email);
    const sessaoToken = novoToken();
    const expiraEm = new Date(Date.now() + VALIDADE_SESSAO_DIAS * 86_400_000);
    await db.query(
      `INSERT INTO canone_identity.session (user_id, refresh_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, hash(sessaoToken), expiraEm]
    );
    return { userId, token: sessaoToken, expiraEm };
  },

  /**
   * Resolve o Bearer da requisição no usuário.
   *
   * NULL = não autenticado (não é erro: a área pública é anônima).
   * Uma sessão revogada ou expirada é recusada — o token continua sendo
   * o mesmo, mas não vale.
   */
  async usuarioDaSessao(db: Db, token: string | null): Promise<string | null> {
    if (!token) return null;
    const r = await db.query<{ user_id: string }>(
      `SELECT s.user_id
         FROM canone_identity.session s
         JOIN canone_identity.account a ON a.id = s.user_id
        WHERE s.refresh_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()
          AND a.status = 'ativo'
          AND a.deleted_at IS NULL
          AND (a.locked_until IS NULL OR a.locked_until <= now())`,
      [hash(token)]
    );
    return r.rows[0]?.user_id ?? null;
  },

  /** Encerra a sessão. */
  async encerrarSessao(db: Db, token: string): Promise<void> {
    await db.query(
      `UPDATE canone_identity.session SET revoked_at = now(), revoked_reason = 'desligamento'
        WHERE refresh_hash = $1 AND revoked_at IS NULL`,
      [hash(token)]
    );
  },

  /**
   * A conta existe? Senão, nasce agora.
   *
   * O primeiro papel é o de VISITANTE: o papel de assinante exige
   * assinatura ativa, e assinatura quem concede é o sistema de cobrança —
   * não o cadastro. O link de acesso prova o e-mail, e nada além disso.
   */
  async assegurarConta(db: Db, email: string): Promise<string> {
    const existente = await db.query<{ id: string; status: string }>(
      `SELECT id, status FROM canone_identity.account WHERE email = $1`,
      [email]
    );
    if (existente.rows[0]) {
      const id = existente.rows[0].id;
      const liberada = await db.query<{ id: string }>(
        `UPDATE canone_identity.account
            SET status = 'ativo', email_verified_at = COALESCE(email_verified_at, now()),
                last_login_at = now(), updated_at = now()
          WHERE id = $1
            AND status IN ('pendente', 'ativo')
            AND deleted_at IS NULL
            AND (locked_until IS NULL OR locked_until <= now())
          RETURNING id`,
        [id]
      );
      if (!liberada.rows[0]) throw new Error('Acesso indisponível.');
      return id;
    }

    const criada = await db.query<{ id: string }>(
      `INSERT INTO canone_identity.account (email, status, email_verified_at)
       VALUES ($1, 'ativo', now())
       RETURNING id`,
      [email]
    );
    const id = criada.rows[0].id;
    await db.query(
      `INSERT INTO canone_identity.user_profile (user_id, display_name) VALUES ($1, $2)`,
      [id, nomeDeExibicao(email)]
    );
    await db.query(
      `INSERT INTO canone_identity.user_role (user_id, role_key) VALUES ($1, 'publico')`,
      [id]
    );
    return id;
  },
};
