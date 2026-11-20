import { useMemo, useState } from 'react';
import { QUESTOES } from '../content/questoes';
import { ExamGateNotice, ExamProgress, ExamQuestion } from '../ui/learning/ExamQuestion';
import {
  advancePreview, backPreview, choosePreview, previewAnswered, publicPreviewQuestion,
  startPreview, type PreviewSession,
} from '../ui/learning/preview-session';

/** S8 is a UI-only pilot; the grade/attempt authority stays entirely in the backend. */
export function Jornada() {
  const questions = useMemo(() => QUESTOES
    .filter(q => q.verificacao === 'a_confirmar' && q.id.startsWith('DEMO-SINTETICA-'))
    .map(q => publicPreviewQuestion(q.id, q.enunciado, q.alternativas)), []);
  const [state, setState] = useState<PreviewSession>(() => startPreview(questions));
  const answered = previewAnswered(state, questions);
  const current = questions[state.position];

  return <div className="shell page" style={{ maxWidth: 860 }}>
    <a href="#/ecossistema" className="btn btn-ghost btn-sm">← Ecossistema</a>
    <header style={{ marginTop: 24 }}>
      <span className="label">S8 · Jornada de demonstração</span>
      <h1 className="display-lg" style={{ marginTop: 10 }}>Questões, uma experiência.</h1>
      <p className="lede" style={{ marginTop: 12, maxWidth: '64ch' }}>
        Experimente a navegação que será reutilizada em Banco de Questões, Simulados,
        Duelo e Simulado Adaptativo. Os exemplos são inteiramente fictícios.
      </p>
    </header>
    <div style={{ marginTop: 24 }}>
      <ExamGateNotice reason="Não há autenticação, tentativa, pontuação, gabarito, publicação normativa ou persistência. As escolhas existem apenas na memória desta página." />
    </div>
    <section className="card" style={{ padding: 24, marginTop: 22 }} aria-label="Demonstração interativa">
      <div className="between wrap" style={{ gap: 12 }}>
        <span className="label-sm">Simulação sintética de interface</span>
        <span className="xs">{state.stage === 'review' ? 'Revisão visual' : `Etapa ${state.position + 1} de ${questions.length}`}</span>
      </div>
      <div style={{ marginTop: 18, marginBottom: 22 }}>
        <ExamProgress answered={answered} total={questions.length} />
      </div>
      {state.stage === 'review' ? <>
        <h2 className="display-md">Suas escolhas na demonstração</h2>
        <p className="body" style={{ marginTop: 12 }}>
          Nenhuma escolha foi enviada ao servidor. Este resumo <strong>não é resultado de prova</strong>,
          não avalia acertos e não gera certificado ou estatística.
        </p>
        <div className="stack" style={{ gap: 12, marginTop: 22 }}>
          {questions.map((q, i) => <div key={q.id} className="card card-flat" style={{ padding: 14 }}>
            <span className="label-sm">Questão {i + 1}</span>
            <p style={{ marginTop: 7 }}>{q.stem}</p>
            <p className="xs" style={{ marginTop: 8 }}>Alternativa selecionada: {state.selections[q.id] ?? 'Nenhuma'}</p>
          </div>)}
        </div>
        <div className="row wrap" style={{ gap: 10, marginTop: 22 }}>
          <button type="button" className="btn btn-ghost" onClick={() => setState(s => backPreview(s))}>Revisar escolhas</button>
          <button type="button" className="btn btn-brass" onClick={() => setState(startPreview(questions))}>Recomeçar demonstração</button>
        </div>
      </> : <>
        <ExamQuestion ordinal={state.position + 1} stem={current.stem} options={current.options}
          selected={state.selections[current.id] ?? null}
          status={<span className="xs">Exemplo fictício · sem correção</span>}
          onChoose={code => setState(s => choosePreview(s, questions, code))} />
        <div className="row wrap" style={{ gap: 10, marginTop: 22 }}>
          <button type="button" className="btn btn-ghost" disabled={state.position === 0}
            onClick={() => setState(s => backPreview(s))}>Voltar</button>
          <button type="button" className="btn btn-brass" disabled={!state.selections[current.id]}
            onClick={() => setState(s => advancePreview(s, questions))}>
            {state.position === questions.length - 1 ? 'Ver escolhas (sem nota)' : 'Próxima questão'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setState(startPreview(questions))}>
            Limpar escolhas
          </button>
        </div>
      </>}
      <div role="status" aria-live="polite" className="xs" style={{ marginTop: 18 }}>
        {answered} de {questions.length} respostas selecionadas nesta sessão de demonstração.
      </div>
    </section>
    <p className="xs" style={{ marginTop: 24 }}>
      O serviço real continuará sendo o motor único de tentativas do backend Cânone,
      condicionado à homologação do PostgreSQL, dos papéis, do conteúdo e do direito de uso.
    </p>
  </div>;
}
