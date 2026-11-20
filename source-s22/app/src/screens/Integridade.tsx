import { useMemo, useState } from 'react';
import { EXAME, NAO_AFILIACAO, CLAIMS_PENDENTES } from '../content/exame';
import { QUESTOES, Q_VERIFICADAS, Q_PENDENTES } from '../content/questoes';
import { MODULOS } from '../content/modulos';

/* ============================================================================
   PÁGINA DE INTEGRIDADE
   ---------------------------------------------------------------------------
   Esta é a página que o material de referência não tem — e é a que sustenta
   a marca. Ela declara, publicamente:

     · quais fatos sobre o exame estão verificados, e onde;
     · quais números estão PENDENTES e por isso não aparecem preenchidos;
     · o que o Cânone NÃO é (não é oficial do CFC nem da FGV);
     · como o aluno pode auditar cada questão.

   Isso não é rodapé de conformidade. É argumento de venda. Um contador que
   vai estudar para um exame regulado não compra promessa — compra procedência.
   ========================================================================== */

export function Integridade() {
  const verificadas = Q_VERIFICADAS().length;
  const pendentes = Q_PENDENTES().length;
  const totalQ = QUESTOES.length;

  return (
    <div className="shell page">
      <span className="label">Integridade editorial</span>
      <h1 className="display-lg" style={{ marginTop: 12, maxWidth: '20ch' }}>
        Como o Cânone decide o que pode afirmar.
      </h1>
      <p className="lede" style={{ marginTop: 16, maxWidth: '58ch' }}>
        Num produto que prepara candidatos para um exame regulado, o número mais importante não é
        quantas questões tem — é quais delas estão verificadas contra a fonte. Publicamos os dois.
      </p>

      {/* ---------------- 1. NÃO AFILIAÇÃO ---------------- */}
      <section className="card" style={{ padding: 28, marginTop: 40, borderColor: 'var(--line-brass)' }}>
        <span className="label">Linha vermelha</span>
        <h2 className="h1" style={{ marginTop: 10, maxWidth: '30ch' }}>O que o Cânone não é.</h2>
        <p className="body" style={{ marginTop: 14, maxWidth: '72ch' }}>{NAO_AFILIACAO}</p>
        <div className="row wrap" style={{ gap: 8, marginTop: 20 }}>
          {['Não é produto oficial do CFC', 'Não é endorsed pela FGV', 'Não promete aprovação', 'Não inventa estatística']
            .map((t) => (
              <span key={t} className="chip" style={{ cursor: 'default' }}>✕ {t}</span>
            ))}
        </div>
      </section>

      {/* ---------------- 2. FATOS VERIFICADOS ---------------- */}
      <section style={{ marginTop: 64 }}>
        <div className="between wrap" style={{ gap: 20, alignItems: 'flex-end' }}>
          <div>
            <span className="label">Fonte de verdade</span>
            <h2 className="display-md" style={{ marginTop: 10 }}>O exame, como a fonte oficial o descreve.</h2>
          </div>
          <span className="xs" style={{ maxWidth: '32ch', fontSize: 11.5, textAlign: 'right' }}>
            Conferido em {EXAME.fontes[0].consultadoEm}
          </span>
        </div>

        <div className="fato-grid" style={{ marginTop: 28 }}>
          {[
            ['Questões', `${EXAME.prova.questoes}`, 'objetivas, múltipla escolha'],
            ['Opções por questão', `${EXAME.prova.opcoes}`, 'A, B, C e D'],
            ['Aprovação', `${EXAME.prova.percentualAprovacao}%`, `${EXAME.prova.pontosAprovacao} de ${EXAME.prova.questoes} pontos`],
            ['Modalidade', 'Presencial', '4 horas, 10h–14h (Brasília)'],
            ['Banca', EXAME.banca, 'aplicação pelo FGV Conhecimento'],
            ['Regulamento', 'Res. CFC nº 1.486/2015', 'vigente'],
          ].map(([k, v, d]) => (
            <div key={k} className="fato">
              <span className="label-sm">{k}</span>
              <span className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', marginTop: 6 }}>{v}</span>
              <span className="xs" style={{ fontSize: 11, marginTop: 3 }}>{d}</span>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <span className="label-sm" style={{ marginBottom: 12, display: 'block' }}>Fontes</span>
          <div className="stack" style={{ gap: 10 }}>
            {EXAME.fontes.map((f) => (
              <a key={f.url} href={f.url} target="_blank" rel="noreferrer noopener"
                className="row between" style={{ paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
                <span className="stack" style={{ gap: 2 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{f.titulo}</span>
                  <span className="num" style={{ fontSize: 10, color: 'var(--tx-faint)' }}>{f.url}</span>
                </span>
                <span className="label-sm">consultar ↗</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 3. CONTEÚDO PROGRAMÁTICO ---------------- */}
      <section style={{ marginTop: 64 }}>
        <span className="label">Conteúdo programático</span>
        <h2 className="display-md" style={{ marginTop: 10, maxWidth: '24ch' }}>
          Os {EXAME.conteudos.length} assuntos da prova de Bacharel.
        </h2>
        <p className="body" style={{ marginTop: 12, maxWidth: '60ch' }}>
          A ordem abaixo é a do edital. O Cânone organiza os {MODULOS.length} módulos a partir dela —
          nenhuma disciplina entra no ecossistema sem estar mapeada aqui.
        </p>
        <div className="row wrap" style={{ gap: 8, marginTop: 24 }}>
          {EXAME.conteudos.map((c, i) => (
            <span key={c} className="chip" style={{ cursor: 'default' }}>
              <span className="num" style={{ fontSize: 10, opacity: .6 }}>{String(i + 1).padStart(2, '0')}</span>
              {c}
            </span>
          ))}
        </div>
      </section>

      {/* ---------------- 4. NÚMEROS PENDENTES ---------------- */}
      <section style={{ marginTop: 64 }}>
        <span className="label">Números que não publicamos</span>
        <h2 className="display-md" style={{ marginTop: 10, maxWidth: '26ch' }}>
          As alegações que ficam pendentes até haver dado real.
        </h2>
        <p className="body" style={{ marginTop: 12, maxWidth: '62ch' }}>
          Material de referência para este projeto trazia “{CLAIMS_PENDENTES[0].exemploRejeitadoNasReferencias}”,
          “{CLAIMS_PENDENTES[1].exemploRejeitadoNasReferencias}” e afins. Nenhum desses números tem fonte. Enquanto não
          houver dado auditável, eles aparecem como placeholder marcado — inclusive no site.
        </p>
        <div className="stack" style={{ marginTop: 24 }}>
          <div className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <span className="label-sm" style={{ width: 190, flex: 'none' }}>Alegação</span>
            <span className="label-sm" style={{ flex: 1 }}>Origem na referência</span>
            <span className="label-sm" style={{ width: 110, textAlign: 'right' }}>Status</span>
          </div>
          {CLAIMS_PENDENTES.map((c) => (
            <div key={c.chave} className="row" style={{ padding: '13px 0', borderBottom: '1px solid var(--line)', gap: 12 }}>
              <span className="pend" style={{ width: 178, flex: 'none' }}>{`{${c.chave}}`}</span>
              <span className="xs" style={{ flex: 1, fontSize: 12 }}>“{c.exemploRejeitadoNasReferencias}”</span>
              <span className="xs" style={{ width: 110, textAlign: 'right', color: 'var(--st-errei)', fontSize: 11 }}>
                não publicado
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- 5. AUDITORIA DE QUESTÕES ---------------- */}
      <AuditQuestions verificadas={verificadas} pendentes={pendentes} total={totalQ} />
    </div>
  );
}

/* ---------------- Auditoria por questão, em tempo real ------------------- */
function AuditQuestions({ verificadas, pendentes, total }: { verificadas: number; pendentes: number; total: number }) {
  const [f, setF] = useState<'todas' | 'verificadas' | 'pendentes'>('todas');
  const lista = useMemo(() => {
    if (f === 'verificadas') return QUESTOES.filter((q) => q.verificacao === 'verificado');
    if (f === 'pendentes') return QUESTOES.filter((q) => q.verificacao === 'a_confirmar');
    return QUESTOES;
  }, [f]);

  return (
    <section style={{ marginTop: 72 }}>
      <div className="between wrap" style={{ gap: 20, alignItems: 'flex-end' }}>
        <div>
          <span className="label">Auditoria item a item</span>
          <h2 className="display-md" style={{ marginTop: 10, maxWidth: '22ch' }}>Cada questão declara sua base.</h2>
        </div>
        <div className="row" style={{ gap: 20 }}>
          <div className="stack" style={{ alignItems: 'flex-end' }}>
            <span className="num" style={{ fontSize: 20, fontWeight: 600, color: 'var(--st-facil)' }}>{verificadas}</span>
            <span className="label-sm">verificadas</span>
          </div>
          <div className="stack" style={{ alignItems: 'flex-end' }}>
            <span className="num" style={{ fontSize: 20, fontWeight: 600, color: 'var(--st-errei)' }}>{pendentes}</span>
            <span className="label-sm">a confirmar</span>
          </div>
          <div className="stack" style={{ alignItems: 'flex-end' }}>
            <span className="num" style={{ fontSize: 20, fontWeight: 600 }}>{total}</span>
            <span className="label-sm">amostra</span>
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginTop: 24 }}>
        {([['todas', 'Todas'], ['verificadas', 'Verificadas'], ['pendentes', 'A confirmar']] as const).map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>
        ))}
      </div>

      <div className="stack" style={{ marginTop: 20, gap: 12 }}>
        {lista.map((q) => (
          <details key={q.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <summary style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center', listStyle: 'none' }}>
              <span className="num" style={{ fontSize: 10.5, color: 'var(--brass-500)', flex: 'none' }}>{q.id}</span>
              <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.4 }}>{q.enunciado.slice(0, 96)}…</span>
              <span className="chip" style={{
                cursor: 'default', height: 26, fontSize: 10,
                borderColor: q.verificacao === 'verificado' ? 'var(--st-facil)' : 'var(--st-errei)',
                color: q.verificacao === 'verificado' ? 'var(--st-facil)' : 'var(--st-errei)',
              }}>
                {q.verificacao === 'verificado' ? '✓ verificado' : '⚠ a confirmar'}
              </span>
            </summary>
            <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 18 }}>
                {(['A', 'B', 'C', 'D'] as const).map((l) => (
                  <div key={l} className="card" style={{
                    padding: '11px 13px',
                    borderColor: l === q.correta ? 'var(--st-facil)' : 'var(--line)',
                    background: l === q.correta ? 'rgba(47,158,99,.07)' : undefined,
                  }}>
                    <div className="row" style={{ gap: 8, marginBottom: 5 }}>
                      <span className="num" style={{
                        fontSize: 10, fontWeight: 700,
                        color: l === q.correta ? 'var(--st-facil)' : 'var(--tx-low)',
                      }}>{l}</span>
                      {l === q.correta && <span className="label-sm" style={{ fontSize: 9, color: 'var(--st-facil)' }}>gabarito</span>}
                    </div>
                    <span className="xs" style={{ fontSize: 11.5, lineHeight: 1.45 }}>{q.alternativas[l]}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: '14px 16px', borderRadius: 6, background: 'rgba(201,169,97,.05)', border: '1px solid var(--line-brass)', marginTop: 16 }}>
                <span className="label-sm" style={{ fontSize: 9 }}>Justificativa</span>
                <p className="body" style={{ fontSize: 12.5, marginTop: 7, lineHeight: 1.55 }}>{q.justificativa}</p>
              </div>

              <div className="stack" style={{ gap: 7, marginTop: 16 }}>
                <span className="label-sm" style={{ fontSize: 9 }}>Por que as outras estão erradas</span>
                {Object.entries(q.porQueErram).map(([l, m]) => (
                  <div key={l} className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                    <span className="num" style={{ fontSize: 10, color: 'var(--st-naosei)', flex: 'none', width: 12 }}>{l}</span>
                    <span className="xs" style={{ fontSize: 11.5, lineHeight: 1.5 }}>{m}</span>
                  </div>
                ))}
              </div>

              <div className="row between wrap" style={{ gap: 12, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                <span className="label-sm" style={{ fontSize: 9 }}>Base normativa</span>
                <span className="num" style={{ fontSize: 10.5, color: 'var(--brass-200)' }}>{q.base}</span>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}