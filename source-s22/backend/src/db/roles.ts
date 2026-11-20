/**
 * PAPÉIS E ÁREAS — o mapa que liga a área do produto ao papel do banco.
 *
 * A área é o que o USUÁRIO é ("estou na área do assinante"). O papel é o
 * que o BANCO entende. O backend traduz — e só traduz de um jeito.
 *
 * A tradução acontece por requisição, dentro de uma transação, com SET
 * LOCAL. O papel técnico (canone_app) é o trampolim: ele nunca é o papel
 * de uma requisição de usuário.
 */
export const AREAS = ['publica', 'acesso', 'assinante', 'staff', 'admin'] as const;
export type Area = (typeof AREAS)[number];

/** Área do produto → papel do banco. */
export const AREA_ROLES: Record<Area, string> = {
  publica: 'canone_public',
  // 'acesso' = o momento de ENTRAR (link e sessão). Papel próprio: quem
  // cria conta e sessão não pode, por isso mesmo, ver conteúdo.
  acesso: 'canone_auth',
  assinante: 'canone_subscriber',
  staff: 'canone_staff',
  admin: 'canone_admin',
};

/** Papel técnico: conecta, troca de papel, nunca é o papel final. */
export const ROLE_TECNICO = 'canone_app';

/** Converte a área em papel, recusando qualquer valor fora do mapa. */
export function roleFor(area: Area): string {
  const role = AREA_ROLES[area];
  if (!role) {
    // O valor NÃO vem do usuário — mas mesmo assim nunca entra no SQL
    // sem passar por este mapa.
    throw new Error(`Área desconhecida: ${String(area)}`);
  }
  return role;
}

export function isArea(v: unknown): v is Area {
  return typeof v === 'string' && (AREAS as readonly string[]).includes(v);
}
