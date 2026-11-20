/** Cânone S15 — modelos transitórios de estudo, sem autoridade acadêmica. */
export type StudyCard = { id: number; front: string; back: string; category: 'flashcards' | 'caderno-erros' };
export type StudyTask = { id: number; topic: string; minutes: number; done: boolean };

function cleanText(value: string, max: number, name: string): string {
  const result = value.trim().replace(/\s+/g, ' ');
  if (!result || result.length > max) throw new Error(`${name}: informe de 1 a ${max} caracteres.`);
  return result;
}
export function createCard(id: number, front: string, back: string, category: StudyCard['category']): StudyCard {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('ID inválido.');
  if (category !== 'flashcards' && category !== 'caderno-erros') throw new Error('Categoria inválida.');
  return { id, front: cleanText(front, 240, 'Frente'), back: cleanText(back, 600, 'Verso'), category };
}
export function createTask(id: number, topic: string, minutes: number): StudyTask {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('ID inválido.');
  if (!Number.isSafeInteger(minutes) || minutes < 5 || minutes > 240) throw new Error('Duração: informe de 5 a 240 minutos inteiros.');
  return { id, topic: cleanText(topic, 160, 'Atividade'), minutes, done: false };
}
export function studySummary(tasks: readonly StudyTask[]): { total: number; done: number; minutes: number; completedMinutes: number; percentage: number } {
  const minutes = tasks.reduce((sum, task) => sum + task.minutes, 0);
  const completedMinutes = tasks.reduce((sum, task) => sum + (task.done ? task.minutes : 0), 0);
  return { total: tasks.length, done: tasks.filter(task => task.done).length, minutes, completedMinutes, percentage: minutes ? Math.round(completedMinutes / minutes * 100) : 0 };
}
