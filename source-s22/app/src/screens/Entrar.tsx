/* ============================================================================
   ACESSO — a porta de entrada do assinante.
   -----------------------------------------------------------------------------
   O Cânone entra por LINK, não por senha: a pessoa informa o e-mail e recebe
   um link de uso único. Não há senha no banco, não há senha a vazar, não há
   senha para o suporte pedir por telefone.

   TRÊS SITUAÇÕES, E NENHUMA MENTIRA (o mesmo desenho do comander)

   · COM BACKEND — o app pede o link, o backend entrega, a pessoa volta com
     o link e o app troca o link por uma sessão.
   · SEM BACKEND — o site é estático e não tem onde entregar link nenhum: a
     tela DIZ isso, em vez de fingir que o e-mail foi enviado.
   · ERRO — o backend respondeu algo fora do contrato: a tela mostra o erro
     em vez de adivinhar o formato.

   HOMOLOGAÇÃO — A sessão não persiste no navegador nesta prévia.
   A produção exigirá backend com cookie HttpOnly, Secure e SameSite,
   CSRF e autorização por papéis verificados no servidor.
   ========================================================================== */
import { useState } from 'react';
import { IcArrow } from '../brand/icons';

let sessaoMemoria: string | null = null;

export interface ConfigAcesso {
  baseUrl: string | null;
}

function configDoAmbiente(): ConfigAcesso {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const url = env.VITE_COMANDER_URL?.trim();
  return { baseUrl: url && url.length > 0 ? url.replace(/\/+$/, '') : null };
}

export function sessaoGuardada(): string | null {
  return sessaoMemoria;
}

export function guardarSessao(token: string | null): void {
  // Não persistir bearer tokens em localStorage, sessionStorage ou IndexedDB.
  sessaoMemoria = token;
}

export function Entrar() {
  const [cfg] = useState(configDoAmbiente);
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado' | 'erro'>('parado');
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function pedirLink(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(null);
    if (!cfg.baseUrl) {
      setEstado('erro');
      setMensagem(
        'Esta instalação é estática: não há servidor para entregar o link de acesso. ' +
          'Com o backend ligado, o mesmo formulário entrega o link por e-mail.'
      );
      return;
    }
    setEstado('enviando');
    try {
      const r = await fetch(`${cfg.baseUrl}/api/auth/link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = (await r.json().catch(() => null)) as { erro?: string } | null;
      if (!r.ok || !json) {
        setEstado('erro');
        setMensagem(json?.erro ?? 'O servidor não respondeu como esperado.');
        return;
      }
      setEstado('enviado');
    } catch {
      setEstado('erro');
      setMensagem('Não foi possível falar com o servidor.');
    }
  }

  async function trocarLink(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(null);
    if (!cfg.baseUrl) {
      setMensagem('Não há backend de autenticação configurado nesta prévia. Nenhuma sessão foi criada.');
      return;
    }
    setEntrando(true);
    try {
      const r = await fetch(`${cfg.baseUrl}/api/auth/sessao`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = (await r.json().catch(() => null)) as { token?: string; erro?: string } | null;
      if (!r.ok || !json?.token) {
        setMensagem(json?.erro ?? 'Link inválido.');
        return;
      }
      guardarSessao(json.token);
      setMensagem('Sessão aberta. A área do assinante abre com o backend ligado.');
    } catch {
      setMensagem('Não foi possível falar com o servidor.');
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="shell page" style={{ maxWidth: '62ch' }}>
      <span className="label">Acesso</span>
      <h1 className="display-lg" style={{ marginTop: 12 }}>Entrar no Cânone</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Sem senha. Informe seu e-mail, receba um link de uso único e entre.
      </p>

      {!cfg.baseUrl && (
        <div className="disclaimer" style={{ marginTop: 26 }}>
          <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" />
          </svg>
          <span>
            <strong>Esta cópia é estática.</strong> O site público funciona inteiro sem servidor —
            mas o acesso do assinante depende dele. Com o backend ligado, este formulário
            entrega o link por e-mail.
          </span>
        </div>
      )}

      <form className="card" style={{ padding: 28, marginTop: 32 }} onSubmit={pedirLink}>
        <span className="label-sm">Passo 1 · pedir o link</span>
        <div className="row" style={{ gap: 12, marginTop: 16 }}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            aria-label="Seu e-mail"
            style={{
              flex: 1, height: 44, paddingInline: 16, borderRadius: 10,
              border: '1px solid var(--line)', background: 'var(--ink-100)', fontSize: 14,
            }}
          />
          <button className="btn btn-brass" type="submit" disabled={estado === 'enviando'}>
            {estado === 'enviando' ? 'Enviando…' : 'Receber link'} <IcArrow className="icon-sm" />
          </button>
        </div>
        {estado === 'enviado' && (
          <p className="xs" style={{ marginTop: 16, color: 'var(--brass-300)' }}>
            Se houver conta para esse e-mail, o link chega em instantes. É de uso único.
          </p>
        )}
        {mensagem && (
          <p className="xs" style={{ marginTop: 16, color: 'var(--tx-low)' }}>{mensagem}</p>
        )}
      </form>

      <form className="card" style={{ padding: 28, marginTop: 20 }} onSubmit={trocarLink}>
        <span className="label-sm">Passo 2 · abrir a sessão</span>
        <p className="xs" style={{ marginTop: 10, maxWidth: '54ch' }}>
          Quem recebeu o link cola o código aqui. É o que o link traz depois do
          domínio — a parte que devolve a sessão.
        </p>
        <div className="row" style={{ gap: 12, marginTop: 16 }}>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="código do link"
            aria-label="Código do link"
            style={{
              flex: 1, height: 44, paddingInline: 16, borderRadius: 10,
              border: '1px solid var(--line)', background: 'var(--ink-100)', fontSize: 14,
            }}
          />
          <button className="btn btn-ghost" type="submit" disabled={entrando}>
            {entrando ? 'Abrindo…' : 'Abrir sessão'}
          </button>
        </div>
      </form>

      <p className="xs" style={{ marginTop: 24, maxWidth: '60ch' }}>
        A conta criada por aqui começa como <strong>visitante</strong>. O acesso de assinante
        depende de assinatura ativa — é o banco que decide, não a tela.
      </p>
    </div>
  );
}
