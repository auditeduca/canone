import type { ReactNode } from 'react';

/**
 * UI ÚNICA de questões (quiz, prova, duelo e adaptativo).
 * Nunca recebe `correctOption`, `isCorrect`, `grade` ou gabarito.
 * A correção e o julgamento pertencem ao serviço de tentativa no backend.
 */
export interface ExamOptionView { code: string; text: string }
export interface ExamQuestionProps {
  ordinal: number;
  stem: string;
  options: readonly ExamOptionView[];
  selected: string | null;
  disabled?: boolean;
  onChoose: (code: string) => void;
  status?: ReactNode;
}
export function ExamQuestion({ordinal,stem,options,selected,disabled=false,onChoose,status}: ExamQuestionProps) {
  return <section aria-labelledby={`question-${ordinal}`} className="stack" style={{gap:12}}>
    <div className="row between wrap" style={{gap:8}}>
      <span className="label-sm">Questão {ordinal}</span>
      {status}
    </div>
    <p id={`question-${ordinal}`} style={{fontSize:13.5,lineHeight:1.45}}>{stem}</p>
    <fieldset disabled={disabled} style={{border:0,margin:0,padding:0,minWidth:0}}>
      <legend className="sr-only">Selecione uma alternativa para a questão {ordinal}</legend>
      <div className="stack" style={{gap:6}}>
        {options.map(({code,text})=>{
          const active=code===selected;
          return <button key={code} type="button" aria-pressed={active}
            className="card" onClick={()=>onChoose(code)}
            style={{padding:'9px 11px',textAlign:'left',cursor:disabled?'not-allowed':'pointer',borderColor:active?'var(--brass-300)':'var(--line)',display:'flex',gap:9,alignItems:'center'}}>
            <span className="num" style={{width:20,height:20,borderRadius:5,display:'grid',placeItems:'center',fontSize:10,fontWeight:700,flex:'none',background:active?'var(--brass-300)':'var(--ink-200)',color:active?'#07070A':'var(--tx-low)'}}>{code}</span>
            <span style={{fontSize:11,lineHeight:1.35}}>{text}</span>
          </button>;
        })}
      </div>
    </fieldset>
  </section>;
}

export function ExamProgress({answered,total}: {answered:number;total:number}) {
  const pct=total>0?Math.max(0,Math.min(100,(answered/total)*100)):0;
  return <div role="progressbar" aria-label="Questões respondidas" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered}>
    <div className="bar" style={{height:3,borderRadius:0}}><div className="bar-fill" style={{width:`${pct}%`}} /></div>
    <span className="xs" style={{display:'block',fontSize:10,marginTop:6}}>{answered} de {total} respostas registradas</span>
  </div>;
}

export function ExamGateNotice({reason}: {reason:string}) {
  return <div className="disclaimer" role="status">
    <strong>Prévia restrita — sem tentativa registrada.</strong> {reason}
  </div>;
}
