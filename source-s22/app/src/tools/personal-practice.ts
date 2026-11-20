/**
 * Cânone S17 — banco pessoal de questões e sessão DEMONSTRATIVA local.
 * NÃO é o motor oficial. Sem gabarito, nota, classificação, telemetria, rede ou persistência.
 * A autoridade de avaliações permanece em backend/src/areas/subscriber/provas.ts.
 */
export const PRACTICE_CODES = ['A', 'B', 'C', 'D'] as const;
export type PracticeCode = typeof PRACTICE_CODES[number];
export type PracticeMode = 'reposicao' | 'simulados';
export type PracticeOptions = Readonly<Record<PracticeCode, string>>;
export interface PersonalQuestion {
  readonly id: number;
  readonly topic: string;
  readonly stem: string;
  readonly options: PracticeOptions;
  readonly sourceNote: string;
  readonly provenance: 'user-authored-unverified';
}
export interface PracticeSession {
  readonly mode: PracticeMode;
  readonly stage: 'choosing' | 'review';
  readonly position: number;
  readonly items: ReadonlyArray<PersonalQuestion>;
  readonly selections: Readonly<Record<string, PracticeCode>>;
}
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
const clean = (value: string, title: string, min: number, max: number) => {
  if (typeof value !== 'string') throw Error(`${title}: texto inválido.`);
  const text = normalize(value);
  if (text.length < min || text.length > max) throw Error(`${title}: use ${min} a ${max} caracteres.`);
  return text;
};
export function createPersonalQuestion(
  id: number, topic: string, stem: string, options: Record<PracticeCode, string>,
  sourceNote: string, existing: readonly PersonalQuestion[] = []
): PersonalQuestion {
  if (!Number.isSafeInteger(id) || id <= 0 || existing.some(x => x.id === id)) throw Error('ID de questão inválido ou duplicado.');
  if (existing.length >= 60) throw Error('Limite de 60 questões nesta sessão.');
  if (!options || Object.keys(options).length !== 4 || PRACTICE_CODES.some(code => !Object.hasOwn(options, code))) {
    throw Error('É necessário informar exatamente quatro alternativas (A–D).');
  }
  const normalizedOptions = Object.fromEntries(PRACTICE_CODES.map(code => [code, clean(options[code], `Alternativa ${code}`, 1, 240)])) as Record<PracticeCode, string>;
  if (new Set(Object.values(normalizedOptions).map(x => x.toLocaleLowerCase('pt-BR'))).size !== 4) {
    throw Error('As quatro alternativas devem ser diferentes.');
  }
  return {
    id,
    topic: clean(topic, 'Tema', 2, 100),
    stem: clean(stem, 'Enunciado', 10, 600),
    options: normalizedOptions,
    sourceNote: clean(sourceNote, 'Referência declarada', 0, 400),
    provenance: 'user-authored-unverified',
  };
}
export function removePersonalQuestion(bank: readonly PersonalQuestion[], id: number): PersonalQuestion[] {
  if (!Number.isSafeInteger(id) || id <= 0) throw Error('Identificador inválido.');
  return bank.filter(q => q.id !== id);
}
export function getPracticeTopics(bank: readonly PersonalQuestion[]): string[] {
  return [...new Set(bank.map(q => q.topic))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
const validateBank = (bank: readonly PersonalQuestion[]) => {
  if (bank.length > 60) throw Error('Banco pessoal excede limite de demonstração.');
  const ids = new Set<number>();
  for (const q of bank) {
    if (ids.has(q.id) || q.provenance !== 'user-authored-unverified') throw Error('Banco sem proveniência autoral válida ou IDs duplicados.');
    ids.add(q.id);
    createPersonalQuestion(q.id, q.topic, q.stem, { ...q.options }, q.sourceNote);
  }
};
export function startPractice(mode: PracticeMode, bank: readonly PersonalQuestion[], topic = '', limit = 10): PracticeSession {
  if (mode !== 'reposicao' && mode !== 'simulados') throw Error('Modo indisponível.');
  validateBank(bank);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) throw Error('Limite de 1 a 20 questões por sessão.');
  const selected = bank.filter(q => !topic || q.topic === topic).slice(0, limit);
  if (!selected.length) throw Error('Crie questões próprias no banco antes de iniciar.');
  // Cópia explícita para uma sessão imutável em relação às edições do banco.
  const items = selected.map(q => ({ ...q, options: { ...q.options } }));
  return { mode, stage: 'choosing', position: 0, items, selections: {} };
}
export function choosePractice(s: PracticeSession, code: PracticeCode): PracticeSession {
  if (s.stage !== 'choosing') return s;
  if (!PRACTICE_CODES.includes(code) || !s.items[s.position]) throw Error('Alternativa indisponível.');
  const item = s.items[s.position];
  return { ...s, selections: { ...s.selections, [String(item.id)]: code } };
}
export function previousPractice(s: PracticeSession): PracticeSession {
  if (s.stage === 'review') return { ...s, stage: 'choosing', position: s.items.length - 1 };
  return { ...s, position: Math.max(0, s.position - 1) };
}
export function nextPractice(s: PracticeSession): PracticeSession {
  if (s.stage !== 'choosing') return s;
  if (!s.items[s.position]) throw Error('Posição indisponível.');
  if (!s.selections[String(s.items[s.position].id)]) throw Error('Selecione uma alternativa antes de continuar.');
  if (s.position === s.items.length - 1) return { ...s, stage: 'review' };
  return { ...s, position: s.position + 1 };
}
export function practiceSummary(s: PracticeSession): { answered: number; total: number; unselected: number } {
  const answered = s.items.filter(q => Boolean(s.selections[String(q.id)])).length;
  return { answered, total: s.items.length, unselected: s.items.length - answered };
}
/** Permite exportação somente das questões escritas pelo usuário, nunca das tentativas oficiais. */
export function exportPersonalBank(bank: readonly PersonalQuestion[]): string {
  validateBank(bank);
  return JSON.stringify({ schema: 'canone.user-authored.questions.s17', scope: 'preview-memory-only',
    authority: 'user-authored-unverified', items: bank }, null, 2);
}
