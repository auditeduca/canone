/**
 * S8: purely presentational, in-memory preview of a question journey.
 * NOT the exam engine. No grading, backend writes, entitlements, answer keys,
 * storage, audit claims or submitted answers. The single real engine remains
 * backend/src/areas/subscriber/provas.ts + learning.* database functions.
 */
export interface PreviewQuestion {
  readonly id: string;
  readonly stem: string;
  readonly options: ReadonlyArray<{ readonly code: string; readonly text: string }>;
}

export interface PreviewSession {
  readonly stage: 'choosing' | 'review';
  readonly position: number;
  readonly selections: Readonly<Record<string, string>>;
}

export function startPreview(questions: readonly PreviewQuestion[]): PreviewSession {
  validateQuestions(questions);
  return { stage: 'choosing', position: 0, selections: {} };
}

export function validateQuestions(questions: readonly PreviewQuestion[]): void {
  if (!questions.length) throw new Error('Nenhuma questão sintética disponível.');
  const ids = new Set<string>();
  for (const q of questions) {
    if (!q.id || !q.stem.trim() || ids.has(q.id)) throw new Error('Questão de demonstração inválida ou duplicada.');
    ids.add(q.id);
    if (q.options.length < 2 || new Set(q.options.map(x => x.code)).size !== q.options.length ||
        q.options.some(x => !x.code || !x.text.trim())) {
      throw new Error('Alternativas sintéticas inválidas ou duplicadas.');
    }
  }
}

export function choosePreview(
  state: PreviewSession, questions: readonly PreviewQuestion[], option: string
): PreviewSession {
  if (state.stage !== 'choosing') return state;
  const current = questions[state.position];
  if (!current || !current.options.some(x => x.code === option)) throw new Error('Alternativa indisponível.');
  return { ...state, selections: { ...state.selections, [current.id]: option } };
}

export function backPreview(state: PreviewSession): PreviewSession {
  if (state.stage === 'review') return { ...state, stage: 'choosing' };
  return { ...state, position: Math.max(0, state.position - 1) };
}

export function advancePreview(state: PreviewSession, questions: readonly PreviewQuestion[]): PreviewSession {
  if (state.stage !== 'choosing') return state;
  if (!questions[state.position] || !state.selections[questions[state.position].id]) return state;
  if (state.position === questions.length - 1) return { ...state, stage: 'review' };
  return { ...state, position: state.position + 1 };
}

export function previewAnswered(state: PreviewSession, questions: readonly PreviewQuestion[]): number {
  return questions.filter(q => q.id in state.selections).length;
}

/** Public preview projection: explicitly whitelists question fields; no "correct" or "justification". */
export function publicPreviewQuestion(id: string, stem: string, alternatives: Record<string, string>): PreviewQuestion {
  return {
    id, stem,
    options: Object.entries(alternatives).map(([code, text]) => ({ code, text })),
  };
}
