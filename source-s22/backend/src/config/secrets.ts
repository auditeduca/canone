/**
 * SEGREDOS — ponte para o cofre.
 *
 * O BANCO GUARDA A REFERÊNCIA, NUNCA O VALOR. Em ops.integration e
 * ops.setting existe `secret_ref`: o nome do segredo no cofre, e nada
 * mais. Se o valor entrasse no banco, um dump de banco seria um vazamento
 * de credenciais.
 *
 * O cofre, por sua vez, é um provedor plugável. As implementações de
 * referência leem do ambiente e de arquivo — suficientes para dev e para
 * CI, etrocar por Vault/AWS/GCP em produção é escrever UM provedor.
 *
 * REGRA: o valor resolvido NUNCA é logado, NUNCA volta para o repositório,
 * e a resolução FALHA FECHADA. Um segredo ausente é um erro visível, não
 * um valor vazio que passa adiante.
 */

export interface SecretProvider {
  /** Devolve o valor do segredo ou lança se não existir. */
  resolve(ref: string): Promise<string>;
}

/** Segredos vindos do ambiente: `CANONE_SECRET_<NOME>`. */
export class EnvSecretProvider implements SecretProvider {
  constructor(private readonly prefix = 'CANONE_SECRET_') {}

  async resolve(ref: string): Promise<string> {
    const key = this.prefix + ref.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
    const value = process.env[key];
    if (value === undefined || value === '') {
      throw new SecretNotFoundError(
        `Segredo "${ref}" não encontrado (procurado em ${key}). A referência existe no banco, ` +
          'mas o cofre não tem o valor — a configuração está incompleta.'
      );
    }
    return value;
  }
}

/** Segredos lidos de um diretório: um arquivo por segredo, nome = ref. */
export class FileSecretProvider implements SecretProvider {
  constructor(private readonly dir: string) {}

  async resolve(ref: string): Promise<string> {
    const { readFile } = await import('node:fs/promises');
    const path = `${this.dir}/${ref}`;
    try {
      const raw = await readFile(path, 'utf8');
      return raw.trim();
    } catch {
      throw new SecretNotFoundError(`Segredo "${ref}" não encontrado em ${this.dir}.`);
    }
  }
}

export class SecretNotFoundError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'SecretNotFoundError';
  }
}

/**
 * COFRE — o ponto único de resolução.
 *
 * Cache por referência, com TTL curto: resolver um segredo por requisição
 * seria caro, mas cachear para sempre seria um segredo obsoleto em
 * produção depois de uma rotação.
 */
export class Vault {
  private readonly cache = new Map<string, { valor: string; expiraEm: number }>();

  constructor(
    private readonly provider: SecretProvider,
    private readonly ttlMs = 60_000
  ) {}

  async resolve(ref: string): Promise<string> {
    const agora = Date.now();
    const guardado = this.cache.get(ref);
    if (guardado && guardado.expiraEm > agora) return guardado.valor;

    const valor = await this.provider.resolve(ref);
    this.cache.set(ref, { valor, expiraEm: agora + this.ttlMs });
    return valor;
  }

  /** Invalida o cache — chamado depois de uma rotação. */
  invalidar(ref?: string): void {
    if (ref) this.cache.delete(ref);
    else this.cache.clear();
  }
}

/**
 * REDIGE segredos para log.
 *
 * Nenhum log do Cânone pode conter credencial. Esta função é o único
 * caminho para "logar uma config", e ela mascara por CHAVE — não por
 * valor, porque o valor é o que não se pode saber sem resolver.
 */
export function redigir<T>(obj: T, chavesSensiveis: RegExp = /senha|secret|token|key|password|credential/i): T {
  if (Array.isArray(obj)) return obj.map((v) => redigir(v, chavesSensiveis)) as unknown as T;
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = chavesSensiveis.test(k) ? '«redigido»' : redigir(v, chavesSensiveis);
    }
    return out as unknown as T;
  }
  return obj;
}
