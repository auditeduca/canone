/** Cânone S14 — matemática determinística para demonstração local.
 * Não envolve dados reais, normativos, avaliação de provas ou operações contábeis.
 * Fórmulas matemáticas básicas, sem utilização do backend.
 */
export type FinancialOperation = 'montante-composto' | 'valor-presente' | 'depreciacao-linear';

export type FinancialInput = {
  operation: FinancialOperation;
  principal: number;
  secondary: number;
  periods: number;
};

export type FinancialResult = {
  value: number;
  formula: string;
  detail: string;
  unit: 'BRL' | 'BRL/periodo';
};

export class InvalidFinancialInput extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidFinancialInput'; }
}

const reject = (message: string): never => { throw new InvalidFinancialInput(message); };
const inRange = (label: string, value: number, min: number, max: number) => {
  if (!Number.isFinite(value) || value < min || value > max) reject(`${label}: informe um número entre ${min} e ${max}.`);
};

/** Periodic rate is entered in percent (e.g. 2 = 2%), never as decimal. */
export function calculateFinancial(input: FinancialInput): FinancialResult {
  if (!['montante-composto', 'valor-presente', 'depreciacao-linear'].includes(input.operation)) {
    return reject('Operação inválida.');
  }
  inRange('Valor monetário', input.principal, 0, 1e12);
  inRange('Períodos', input.periods, 1, 600);
  if (!Number.isInteger(input.periods)) reject('Períodos: informe um número inteiro.');

  if (input.operation === 'depreciacao-linear') {
    inRange('Valor residual', input.secondary, 0, 1e12);
    if (input.secondary > input.principal) reject('O valor residual não pode exceder o custo.');
    return {
      value: (input.principal - input.secondary) / input.periods,
      formula: '(Custo − valor residual) ÷ períodos',
      detail: 'Quota matemática uniforme por período. Não determina vida útil fiscal ou societária.',
      unit: 'BRL/periodo',
    };
  }

  inRange('Taxa percentual por período', input.secondary, -99.99, 1000);
  const factor = Math.pow(1 + input.secondary / 100, input.periods);
  if (!Number.isFinite(factor) || factor <= 0) reject('Os parâmetros não produzem resultado finito.');
  const value = input.operation === 'montante-composto'
    ? input.principal * factor
    : input.principal / factor;
  if (!Number.isFinite(value) || value > 1e15) reject('Resultado fora do limite de demonstração.');
  return {
    value,
    formula: input.operation === 'montante-composto' ? 'VF = VP × (1 + i)^n' : 'VP = VF ÷ (1 + i)^n',
    detail: 'Taxa e prazo devem se referir à mesma periodicidade; sem taxas, tributos ou indexadores adicionais.',
    unit: 'BRL',
  };
}
