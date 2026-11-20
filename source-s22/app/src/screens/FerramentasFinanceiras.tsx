import { useMemo, useState } from 'react';
import { calculateFinancial, InvalidFinancialInput, type FinancialOperation } from '../tools/finance-math';

const choices: { id: FinancialOperation; label: string; description: string }[] = [
  { id: 'montante-composto', label: 'Montante composto', description: 'Projete o valor futuro a uma taxa fixa por período.' },
  { id: 'valor-presente', label: 'Valor presente', description: 'Desconte um valor futuro usando taxa fixa por período.' },
  { id: 'depreciacao-linear', label: 'Quota linear', description: 'Calcule uma quota aritmética uniforme de depreciação.' },
];
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const decimal = (raw: string): number => {
  if (!/^\d+(?:[.,]\d+)?$/.test(raw.trim())) return NaN;
  return Number(raw.trim().replace(',', '.'));
};

/** Browser-only tools. No personal data, grade or persistable canonical result. */
export function FerramentasFinanceiras({ origin }: { origin: 'matematica' | 'calculadoras' }) {
  const [operation, setOperation] = useState<FinancialOperation>('montante-composto');
  const [principal, setPrincipal] = useState('1000');
  const [secondary, setSecondary] = useState('2');
  const [periods, setPeriods] = useState('12');
  const [submitted, setSubmitted] = useState(false);
  const isDep = operation === 'depreciacao-linear';
  const title = origin === 'matematica' ? 'Matemática Financeira' : 'Calculadoras Contábeis';
  const result = useMemo(() => {
    if (!submitted) return null;
    try {
      return { data: calculateFinancial({ operation, principal: decimal(principal), secondary: decimal(secondary), periods: decimal(periods) }), error: null };
    } catch (error) {
      return { data: null, error: error instanceof InvalidFinancialInput ? error.message : 'Erro inesperado de cálculo.' };
    }
  }, [submitted, operation, principal, secondary, periods]);
  function change<T>(setter: (value: T) => void, next: T) { setter(next); setSubmitted(false); }
  return <div className="shell page" style={{ maxWidth: 1080 }}>
    <a className="btn btn-ghost btn-sm" href="#/ecossistema">← Ecossistema</a>
    <header style={{ marginTop: 28 }}>
      <span className="label">Laboratório local • S14 • prévia sem conta</span>
      <h1 className="display-lg" style={{ marginTop: 14 }}>{title}</h1>
      <p className="lede" style={{ marginTop: 12 }}>Ferramentas matemáticas com cálculos reais no navegador, sem conexão a banco ou atribuição de notas.</p>
    </header>
    <div className="card" role="note" style={{ padding: 20, marginTop: 24, borderColor: 'var(--line-brass)' }}>
      <strong>Escopo restrito.</strong> Simulador didático: não é aconselhamento financeiro, laudo de avaliação, cálculo fiscal, orientação contábil normativa ou lançamento oficial. Os valores não são enviados ou armazenados.
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 22, marginTop: 24, alignItems: 'start' }}>
      <form className="card" style={{ padding: 26 }} noValidate onSubmit={e => { e.preventDefault(); setSubmitted(true); }}>
        <label htmlFor="financial-operation" className="label-sm">Tipo de operação</label>
        <select id="financial-operation" value={operation} onChange={e => {
          const next = e.target.value as FinancialOperation;
          change(setOperation, next); setSecondary(next === 'depreciacao-linear' ? '100' : '2');
        }} style={{ display: 'block', width: '100%', margin: '12px 0 18px', padding: 12, border: '1px solid var(--line-strong)', borderRadius: 8, color: 'var(--tx-hi)', background: 'var(--ink-150)' }}>
          {choices.map(ch => <option value={ch.id} key={ch.id}>{ch.label}</option>)}
        </select>
        <p className="xs" style={{ marginBottom: 22 }}>{choices.find(ch => ch.id === operation)?.description}</p>
        <div className="stack" style={{ gap: 18 }}>
          <label className="stack" style={{ gap: 7 }} htmlFor="principal"><span className="label-sm">{isDep ? 'Custo (R$)' : operation === 'valor-presente' ? 'Valor futuro (R$)' : 'Valor presente (R$)'}</span>
            <input id="principal" inputMode="decimal" required value={principal} onChange={e => change(setPrincipal, e.target.value)} style={fieldStyle}/>
          </label>
          <label className="stack" style={{ gap: 7 }} htmlFor="secondary"><span className="label-sm">{isDep ? 'Valor residual (R$)' : 'Taxa por período (%)'}</span>
            <input id="secondary" inputMode="decimal" required value={secondary} onChange={e => change(setSecondary, e.target.value)} style={fieldStyle}/>
          </label>
          <label className="stack" style={{ gap: 7 }} htmlFor="periods"><span className="label-sm">Quantidade de períodos (inteiro)</span>
            <input id="periods" inputMode="numeric" required value={periods} onChange={e => change(setPeriods, e.target.value)} style={fieldStyle}/>
          </label>
          <button type="submit" className="btn btn-brass">Calcular</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPrincipal('1000'); setSecondary(operation === 'depreciacao-linear' ? '100' : '2'); setPeriods('12'); setSubmitted(false); }}>Restaurar exemplo</button>
        </div>
      </form>
      <section className="card" style={{ padding: 26, minHeight: 300 }} aria-label="Resultado de cálculo" aria-live="polite">
        <span className="label">Resultado matemático</span>
        {!submitted && <p className="body" style={{ marginTop: 24 }}>Informe os parâmetros e selecione <strong>Calcular</strong>. Não há envio ao servidor.</p>}
        {result?.error && <p role="alert" style={{ color: 'var(--tx-hi)', border: '1px solid var(--line-brass)', padding: 14, marginTop: 24 }}>{result.error}</p>}
        {result?.data && <>
          <div className="display-md num" style={{ marginTop: 26, overflowWrap: 'anywhere' }}>{money.format(result.data.value)}</div>
          <div className="xs" style={{ marginTop: 8 }}>{result.data.unit === 'BRL/periodo' ? 'por período' : 'valor calculado'}</div>
          <hr className="hr" style={{ marginBlock: 24 }}/>
          <span className="label-sm">Fórmula utilizada</span>
          <p className="body" style={{ marginTop: 10 }}>{result.data.formula}</p>
          <p className="xs" style={{ marginTop: 18 }}>{result.data.detail}</p>
          <p className="xs" style={{ marginTop: 16 }}>Apresentação monetária arredondada a 2 casas decimais; cálculo interno sem arredondamento intermediário.</p>
        </>}
      </section>
    </div>
    <p className="xs" style={{ marginTop: 28 }}>As avaliações, os simulados, a revisão espaçada persistente e o dashboard continuam dependentes do motor canônico e da homologação de permissões.</p>
  </div>;
}
const fieldStyle: React.CSSProperties = { width: '100%', padding: 12, border: '1px solid var(--line-strong)', borderRadius: 8, color: 'var(--tx-hi)', background: 'var(--ink-150)', fontSize: 16 };
