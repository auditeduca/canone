/**
 * CLIENTE DO COMANDER — a conversa do app com a área do administrador.
 * ============================================================================
 * O app é ESTÁTICO: ele não tem servidor, é deployado em qualquer lugar.
 * A área do administrador, porém, não é uma página de marketing — é uma
 * ferramenta que age sobre o banco. Por isso ela é a única parte do app
 * que precisa de um backend por perto.
 *
 * TRÊS SITUAÇÕES, E NENHUMA MENTIRA
 *
 *   · COM BACKEND — o cliente fala HTTP com o comander do backend.
 *   · SEM BACKEND — o app mostra o CATÁLOGO (que é gerado do backend e
 *     está versionado no app) e diz, na tela, que os comandos não são
 *     executados. Não há número inventado, não há estado inventado: a
 *     governança sem banco não tem estado, e a tela diz isso.
 *   · ERRO — o backend respondeu algo que não é o contrato. A tela mostra
 *     o erro em vez de tentar adivinhar o formato.
 *
 * O CATÁLOGO NÃO É ESCRITO À MÃO
 *
 * Vem de `contrato-comander.ts`, que é GERADO do backend. Se o servidor
 * mandar um catálogo diferente do que está no app, a diferença aparece na
 * tela (e o teste do backend confere que o arquivo gerado está em dia).
 */
import {
  COMANDOS,
  type CatalogoComando,
  type EstadoComander,
  type ResultadoComando,
} from './contrato-comander';

export interface ConfigComander {
  /** Base do backend (ex.: http://127.0.0.1:8787). null = sem backend. */
  baseUrl: string | null;
  /** Token do operador. */
  token: string | null;
}

export interface Resultado<T> {
  ok: boolean;
  dados?: T;
  erro?: string;
}

function configDoAmbiente(): ConfigComander {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const url = env.VITE_COMANDER_URL?.trim();
  return {
    baseUrl: url && url.length > 0 ? url.replace(/\/+$/, '') : null,
    token: null, // SECURITY_S2: browser bundles never receive operator secrets.
  };
}

export class ClienteComander {
  private readonly base: string | null;
  private readonly token: string | null;

  constructor(cfg: ConfigComander = configDoAmbiente()) {
    this.base = cfg.baseUrl;
    this.token = cfg.token;
  }

  /** Sem backend: o comander existe como catálogo, mas não executa nada. */
  get semBackend(): boolean {
    return this.base === null;
  }

  /** O catálogo do servidor, quando há servidor. O do app é o gerado. */
  async catalogoDoServidor(): Promise<Resultado<CatalogoComando[]>> {
    if (this.semBackend) return { ok: false, erro: 'Sem backend configurado.' };
    try {
      const r = await fetch(`${this.base}/api/comander/comandos`, {
        headers: this.cabecalho(),
      });
      if (!r.ok) return { ok: false, erro: `O servidor respondeu ${r.status}.` };
      const corpo = (await r.json()) as { comandos?: CatalogoComando[] };
      if (!Array.isArray(corpo.comandos)) {
        return { ok: false, erro: 'O servidor não devolveu um catálogo no formato esperado.' };
      }
      return { ok: true, dados: corpo.comandos };
    } catch (e) {
      return { ok: false, erro: `Não foi possível falar com o comander: ${(e as Error).message}` };
    }
  }

  async previa(id: string, entrada: Record<string, string>): Promise<Resultado<ResultadoComando>> {
    return this.postar(`/api/comander/comandos/${id}/previa`, entrada);
  }

  async executar(id: string, entrada: Record<string, string>): Promise<Resultado<ResultadoComando>> {
    return this.postar(`/api/comander/comandos/${id}`, entrada);
  }

  async estado(): Promise<Resultado<EstadoComander>> {
    if (this.semBackend) return { ok: false, erro: 'Sem backend configurado.' };
    try {
      const r = await fetch(`${this.base}/api/comander/estado`, { headers: this.cabecalho() });
      if (r.status === 401) return { ok: false, erro: 'Token ausente ou inválido.' };
      if (!r.ok) return { ok: false, erro: `O servidor respondeu ${r.status}.` };
      const corpo = (await r.json()) as Partial<EstadoComander>;
      const chaves: (keyof EstadoComander)[] = [
        'saude', 'provas', 'recusas', 'fila', 'concessoes', 'auditoria', 'cadeia',
      ];
      for (const k of chaves) {
        if (!(k in corpo)) {
          return { ok: false, erro: `O estado veio sem "${k}" — formato desconhecido.` };
        }
      }
      return { ok: true, dados: corpo as EstadoComander };
    } catch (e) {
      return { ok: false, erro: `Não foi possível ler o estado: ${(e as Error).message}` };
    }
  }

  private cabecalho(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (this.token) h.authorization = `Bearer ${this.token}`;
    return h;
  }

  private async postar(
    caminho: string,
    entrada: Record<string, string>
  ): Promise<Resultado<ResultadoComando>> {
    if (this.semBackend) return { ok: false, erro: 'Sem backend configurado.' };
    try {
      const r = await fetch(`${this.base}${caminho}`, {
        method: 'POST',
        headers: this.cabecalho(),
        body: JSON.stringify({ entrada }),
      });
      const corpo = (await r.json()) as ResultadoComando & { erro?: string };
      if (corpo && typeof corpo.ok === 'boolean') return { ok: true, dados: corpo };
      return { ok: false, erro: corpo?.erro ?? 'Resposta fora do formato esperado.' };
    } catch (e) {
      return { ok: false, erro: `Não foi possível falar com o comander: ${(e as Error).message}` };
    }
  }
}

/** O catálogo que o app conhece sem backend — o arquivo gerado. */
export const CATALOGO_LOCAL = COMANDOS;

/**
 * A diferença entre o catálogo do servidor e o do app.
 *
 * Se um comando existe no servidor e não no app (ou o contrário), a
 * diferença é MOSTRADA. Divergência de contrato não pode ser silenciosa.
 */
export function divergenciaDeCatalogo(
  servidor: CatalogoComando[],
  local: CatalogoComando[]
): { apenasNoServidor: string[]; apenasNoApp: string[] } {
  const idsServidor = new Set(servidor.map((c) => c.id));
  const idsLocal = new Set(local.map((c) => c.id));
  return {
    apenasNoServidor: servidor.filter((c) => !idsLocal.has(c.id)).map((c) => c.id),
    apenasNoApp: local.filter((c) => !idsServidor.has(c.id)).map((c) => c.id),
  };
}
