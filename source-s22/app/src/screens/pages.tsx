import { useState } from 'react';
import { Phone, Ring, Spark, Pillar } from '../ui/primitives';
import { Disclaimer } from '../ui/Nav';
import {
  ConceptFlashcards, ConceptShowcase, type ConceptSpec,
  PList, POptions, PCompare, PMap, PCalendar, PProgresso, PhoneChrome,
} from './concepts';
import { ScreenQuiz } from './phoneScreens';
import {
  IcArrow, IcDownload, IcBolt, IcCards, IcMap, IcBookOpen, IcFile, 
  IcLock, IcTarget, IcSwords, IcShield, IcCalculator, IcScale, IcGem, IcPlay,
} from '../brand/icons';
import { IcGauge } from '../content/icones-internos';
import { MODULOS, FASES, porFase, type Fase } from '../content/modulos';
import { QUESTOES } from '../content/questoes';
import { EXAME, CLAIMS_PENDENTES } from '../content/exame';

/* ============================================================================
   PÁGINAS PÚBLICAS
   As duas variantes de home das referências (escura e clara) compartilham a
   mesma arquitetura — muda o tema, não a estrutura. É isso que "harmonizar"
   significa: uma decisão de layout, aplicada com rigor.
   ========================================================================== */

/* ------------------------- BLOCO: ESTATÍSTICAS --------------------------
   REGRA DE INTEGRIDADE: as referências trazem "+40 mil alunos", "4.9 ★",
   "1.240 questões", "+62% evolução", "320h". Esses números NÃO existem até
   o cliente fornecer dado real. Aqui eles aparecem como placeholder marcado,
   não como fato. Um dashboard bonito com número falso destrói confiança.
   ========================================================================== */
function StatStrip() {
  return (
    <section className="strip">
      <div className="shell">
        <div className="stat-grid">
          {CLAIMS_PENDENTES.map((c) => (
            <div key={c.chave} className="stat">
              <span className="pend">{`{${c.chave}}`}</span>
              <span className="xs" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.45 }}>{c.rotulo}</span>
              <span className="screen-no" style={{ display: 'block', marginTop: 6 }}>
                pendente de dado real
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ HOME ESCURA ----------------------------- */
export function Home({ variant }: { variant: 'escuro' | 'claro' }) {
  const claro = variant === 'claro';
  return (
    <div data-theme={claro ? 'paper' : 'ink'}>
      {/* ================= HERO ================= */}
      <section className="hero" data-clearing={claro}>
        <div className="shell hero-grid">
          <div className="hero-copy">
            <div className="label-rule label-rule-brass" style={{ maxWidth: 210 }}>
              <span className="label">Estude com propósito.</span>
            </div>
            <h1 className="display-lg" style={{ marginTop: 18 }}>
              O app que transforma sua preparação para o Exame de Suficiência.
            </h1>
            <p className="lede" style={{ marginTop: 18 }}>
              Simulados, trilhas, flashcards, questões comentadas e desempenho em uma experiência premium.
            </p>
            <div className="row wrap" style={{ gap: 12, marginTop: 30 }}>
              <a className="btn btn-brass" href="#/planos">
                <IcDownload className="icon-sm" /> Baixar o app
              </a>
              <a className="btn btn-ghost" href="#/recursos">Conhecer recursos <IcArrow className="icon-sm" /></a>
            </div>
          </div>

          <div className="hero-phones">
            <Phone className="tilt-l"><div className="grow" style={{ padding: 14 }}>
              <div className="bar" style={{ marginBottom: 12 }}><div className="bar-fill" style={{ width: '68%' }} /></div>
              <span style={{ fontSize: 10, color: 'var(--tx-low)' }}>Olá, Ana. Vamos continuar?</span>
              <div className="card" style={{ padding: 11, marginTop: 10 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600 }}>Contabilidade Geral</span>
                <div className="bar bar-sm" style={{ marginTop: 7 }}><div className="bar-fill" style={{ width: '68%' }} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 8 }}>
                {['Flashcards', 'Simulados', 'Questões', 'Desempenho'].map((t) => (
                  <div key={t} className="card" style={{ padding: 9 }}><span style={{ fontSize: 9.5 }}>{t}</span></div>
                ))}
              </div>
            </div></Phone>
            <Phone className="tilt-r"><div className="grow" style={{ padding: 14 }}>
              <span className="label-sm" style={{ fontSize: 8 }}>Pergunta</span>
              <p style={{ fontFamily: 'var(--f-display)', fontSize: 16, lineHeight: 1.25, marginTop: 9 }}>
                Qual é o princípio da competência?
              </p>
              <div style={{ marginTop: 'auto', padding: 11, borderRadius: 999, textAlign: 'center', background: 'var(--brass-300)', color: 'var(--brass-on)', fontSize: 11, fontWeight: 600 }}>
                Ver resposta →
              </div>
            </div></Phone>
          </div>
        </div>
      </section>

      <StatStrip />

      {/* ================= BENEFÍCIOS ================= */}
      <section className="shell" style={{ paddingBlock: 88 }}>
        <div className="split-2">
          <div>
            <span className="label">Flashcards</span>
            <h2 className="display-md" style={{ marginTop: 12 }}>Fixe o conteúdo com muito mais eficiência.</h2>
            <p className="body" style={{ marginTop: 16, maxWidth: '46ch' }}>
              O sistema de flashcards combina repetição espaçada e revisão ativa. O algoritmo prioriza
              o conteúdo que ainda não está consolidado — os conceitos que realmente aparecem na prova.
            </p>
            <a className="btn btn-solid-ink" style={{ marginTop: 26 }} href="#/recursos">
              Explorar flashcards <IcArrow className="icon-sm" />
            </a>
          </div>
          <div className="row" style={{ gap: 20, justifyContent: 'center' }}>
            <Phone><PhoneChrome titulo="Decks" idx={0} active>
              <PList filtro={['Minhas disciplinas', 'Revisão']} items={[
                { t: 'Contabilidade Geral', s: '300 cards', p: 72 },
                { t: 'Contabilidade de Custos', s: '184 cards', p: 38 },
                { t: 'Auditoria Contábil', s: '274 cards', p: 45 },
                { t: 'CPCs e Normas', s: '62 cards', p: 28 },
                { t: 'Perícia Contábil', s: '118 cards', p: 12 },
              ]} />
            </PhoneChrome></Phone>
            <Phone><PhoneChrome titulo="Revisão" idx={1} active>
              <div className="stack" style={{ padding: 14, gap: 9 }}>
                <span style={{ fontSize: 9, color: 'var(--tx-faint)' }}>Auditoria Contábil</span>
                <p style={{ fontSize: 13.5, lineHeight: 1.4, fontWeight: 500 }}>
                  O que é evidência de auditoria?
                </p>
                <div style={{ display: 'grid', gap: 5 }}>
                  {['Erro', 'Rever', 'Acertei'].map((t, i) => (
                    <div key={t} className="row" style={{
                      gap: 8, padding: '9px 11px', borderRadius: 999,
                      border: '1px solid var(--line)', justifyContent: 'center',
                    }}>
                      <span style={{
                        width: 15, height: 15, borderRadius: 999,
                        background: ['var(--st-naosei)', 'var(--st-errei)', 'var(--st-facil)'][i],
                      }} />
                      <span style={{ fontSize: 10.5, fontWeight: 600 }}>{t}</span>
                    </div>
                  ))}
                </div>
                <button className="btn btn-brass btn-sm" style={{ marginTop: 4 }}>Ver resposta</button>
              </div>
            </PhoneChrome></Phone>
          </div>
        </div>

        <hr className="hr" style={{ marginBlock: 72 }} />

        <div className="split-2 rev">
          <div className="row" style={{ gap: 20, justifyContent: 'center' }}>
            <Phone paper><PhoneChrome titulo="Quiz" idx={2} active>
              <div className="stack" style={{ padding: 14, gap: 8 }}>
                <span className="label-sm" style={{ fontSize: 8 }}>Auditoria Contábil</span>
                <p style={{ fontSize: 12.5, lineHeight: 1.4, fontWeight: 500 }}>
                  São informações obtidas por meio de perguntas feitas a terceiros.
                </p>
                {['Erro', 'Rever', 'Acertei'].map((t, i) => (
                  <div key={t} className="row" style={{
                    gap: 8, padding: 10, borderRadius: 999,
                    background: i === 0 ? 'var(--brass-300)' : 'var(--paper-000)',
                    border: '1px solid var(--paper-200)', justifyContent: 'center',
                  }}>
                    <span style={{ width: 14, height: 14, borderRadius: 999, background: ['var(--st-naosei)', 'var(--st-errei)', 'var(--st-facil)'][i] }} />
                    <span style={{ fontSize: 10.5, fontWeight: 600 }}>{t}</span>
                  </div>
                ))}
              </div>
            </PhoneChrome></Phone>
          </div>
          <div>
            <span className="label">Estudo mais inteligente</span>
            <h2 className="display-md" style={{ marginTop: 12 }}>Pequenos cards, grandes resultados.</h2>
            <p className="body" style={{ marginTop: 16, maxWidth: '46ch' }}>
              Memorização ativa para você chegar mais preparado no seu objetivo. A cada resposta,
              o Cânone recalcula o que você precisa revisar — e o que já está consolidado.
            </p>
            <div className="stack" style={{ gap: 16, marginTop: 28 }}>
              {[
                { I: IcBolt,  t: 'Revisão por disciplina',   d: 'Conteúdos organizados conforme o edital vigente.' },
                { I: IcGauge, t: 'Desempenho em tempo real', d: 'Estatísticas detalhadas do seu desempenho.' },
                { I: IcLock,  t: 'Foco total',              d: 'Design limpo, zero ruído: só os seus objetivos.' },
              ].map(({ I, t, d }) => (
                <Pillar key={t} icon={<I className="icon-lg" />} title={t}>{d}</Pillar>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="strip" data-theme="ink">
        <div className="shell">
          <div className="split-2" style={{ alignItems: 'center' }}>
            <div>
              <span className="label">Sua evolução em números</span>
              <h2 className="display-md" style={{ marginTop: 12, maxWidth: '18ch' }}>
                Acompanhe seu progresso e estude com mais estratégia.
              </h2>
            </div>
            <div className="row" style={{ gap: 28, flexWrap: 'wrap' }}>
              {CLAIMS_PENDENTES.slice(0, 4).map((c) => (
                <div key={c.chave} className="stack" style={{ gap: 6 }}>
                  <span className="pend">{`{${c.chave}}`}</span>
                  <span className="xs" style={{ fontSize: 11 }}>{c.rotulo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= NÃO AFILIAÇÃO ================= */}
      <section className="shell" style={{ paddingBlock: 48 }}>
        <Disclaimer variant="box" />
      </section>
    </div>
  );
}

/* ============================ CONTEÚDOS ================================= */
export function Conteudos() {
  const [filtro, setFiltro] = useState('Todos');
  const FILTROS = ['Todos', 'Contabilidade Geral', 'Auditoria', 'Legislação', 'Estratégia', 'Flashcards'];
  const ARTIGOS = [
    { cat: 'Estratégia', data: '21 de outubro de 2026', t: 'Como estudar para o Exame de Suficiência com método e constância',
      d: 'Descubra um passo a passo prático para organizar seus estudos, manter a disciplina e chegar preparado no Exame de Suficiência CFC.', img: 'hero' },
    { cat: 'Estratégia', data: '18 de outubro de 2026', t: 'Como montar um plano de revisão para 30 dias',
      d: 'Um roteiro prático para revisar os principais temas do edital e otimizar seu tempo na reta final.' },
    { cat: 'Contabilidade Geral', data: '15 de outubro de 2026', t: 'Os erros mais comuns em Contabilidade Geral',
      d: 'Conheça os principais erros que levam à perda de pontos e saiba como evitá-los nas questões do CFC.' },
    { cat: 'Flashcards', data: '12 de outubro de 2026', t: 'Como usar flashcards para fixar CPCs e normas',
      d: 'Veja como os flashcards podem acelerar sua memorização e melhorar seu desempenho nas questões.' },
    { cat: 'Auditoria', data: '8 de outubro de 2026', t: 'Como interpretar questões de Auditoria com mais precisão',
      d: 'Aprenda a identificar palavras-chave, entender o que a banca realmente cobra e evitar armadilhas.' },
    { cat: 'Simulados', data: '4 de outubro de 2026', t: 'Estratégias para melhorar seu desempenho em simulados',
      d: 'Dicas práticas para aproveitar melhor os simulados e transformar erros em aprendizado.' },
    { cat: 'Estratégia', data: '1 de outubro de 2026', t: 'O que priorizar na reta final para o Exame de Suficiência',
      d: 'Entenda quais assuntos merecem mais atenção nos últimos dias e como revisar de forma inteligente.' },
  ];
  const lista = filtro === 'Todos' ? ARTIGOS : ARTIGOS.filter((a) => a.cat === filtro);

  return (
    <div className="shell page">
      <span className="label">Conteúdos</span>
      <h1 className="display-lg" style={{ marginTop: 12 }}>Conteúdos</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Aprenda, revise e evolua na sua preparação para o Exame de Suficiência do CFC.
      </p>

      <div className="row wrap" style={{ gap: 8, marginTop: 26 }}>
        {FILTROS.map((f) => (
          <button key={f} className="chip" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>{f}</button>
        ))}
      </div>

      {/* Destaque */}
      <article className="destaque">
        <div className="destaque-art">
          <span className="label-sm">Contabilidade Geral</span>
          <div className="stack" style={{ gap: 5 }}>
            {['Contabilidade Geral', 'Auditoria', 'CPCs e Normas', 'Legislação'].map((t) => (
              <span key={t} style={{
                fontFamily: 'var(--f-display)', fontSize: 13, padding: '5px 11px',
                border: '1px solid var(--brass-500)', borderRadius: 3, color: 'var(--brass-200)',
              }}>{t}</span>
            ))}
          </div>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 12 }}>
            <span className="label-sm">Estratégia</span>
            <span className="label-sm">21 de outubro de 2026</span>
          </div>
          <h2 className="h1" style={{ fontSize: '1.75rem', maxWidth: '22ch' }}>{ARTIGOS[0].t}</h2>
          <p className="body" style={{ maxWidth: '52ch' }}>{ARTIGOS[0].d}</p>
          <a className="btn btn-solid-ink btn-sm" href="#/conteudos" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            Ler o artigo completo <IcArrow className="icon-sm" />
          </a>
        </div>
      </article>

      {/* Lista */}
      <div className="stack" style={{ marginTop: 44 }}>
        {lista.map((a, i) => (
          <article key={a.t} className="art-row">
            <div className="stack" style={{ gap: 4, minWidth: 128 }}>
              <span className="label-sm">{a.cat}</span>
              <span className="num" style={{ fontSize: 11, color: 'var(--tx-low)' }}>{a.data}</span>
            </div>
            <div className="stack" style={{ gap: 5 }}>
              <a href="#/conteudos"><h3 className="h2" style={{ fontSize: '1.3125rem' }}>{a.t}</h3></a>
              <p className="xs" style={{ maxWidth: '58ch', lineHeight: 1.55 }}>{a.d}</p>
            </div>
            <span className="art-thumb" aria-hidden="true"><span className="num" style={{ fontSize: 22, color: 'var(--brass-500)' }}>{String(i + 1).padStart(2, '0')}</span></span>
          </article>
        ))}
      </div>

      <div className="row" style={{ gap: 8, justifyContent: 'center', marginTop: 40 }}>
        {[1, 2, 3].map((n) => (
          <button key={n} className="chip" aria-pressed={n === 1} style={{ width: 38, justifyContent: 'center', padding: 0 }}>{n}</button>
        ))}
        <span className="chip" style={{ borderStyle: 'none' }}>…</span>
        <button className="chip">Próxima <IcArrow className="icon-sm" /></button>
      </div>

      <div style={{ marginTop: 56 }}><Disclaimer variant="box" /></div>
    </div>
  );
}

/* ============================ ECOSSISTEMA ================================ */
export function Ecossistema() {
  const [fase, setFase] = useState<Fase | 'Todos'>('Todos');
  const lista = fase === 'Todos' ? MODULOS : porFase(fase);

  return (
    <div className="shell page">
      <div className="between wrap" style={{ gap: 24, alignItems: 'flex-end' }}>
        <div>
          <span className="label">Ecossistema contábil</span>
          <h1 className="display-lg" style={{ marginTop: 12 }}>Estude. Pratique. Evolua. Aprove.</h1>
          <p className="lede" style={{ marginTop: 12 }}>
            Um ecossistema completo para sua aprovação no Exame de Suficiência CFC.
          </p>
        </div>
        <div className="stack" style={{ gap: 9, alignItems: 'flex-end' }}>
          <span className="label-sm">{MODULOS.length} módulos</span>
          <span className="xs" style={{ maxWidth: '34ch', textAlign: 'right', fontSize: 11.5 }}>
            Conteúdo em homologação · Evidências pendentes · Mesmo Design System em todos os recursos
          </span>
        </div>
      </div>

      <div className="row wrap" style={{ gap: 8, marginTop: 32 }}>
        {(['Todos', ...FASES.map((f) => f.nome)] as const).map((f) => (
          <button key={f} className="chip" aria-pressed={fase === f} onClick={() => setFase(f)}>{f}</button>
        ))}
      </div>

      <div className="mod-grid" style={{ marginTop: 32 }}>
        {lista.map((m) => (
          <a key={m.id} href={`#/modulo/${m.id}`} className="mod-card">
            <div className="between" style={{ marginBottom: 12 }}>
              <span className="num" style={{ fontSize: 11, color: 'var(--brass-500)' }}>
                {String(m.n).padStart(2, '0')}
              </span>
              <span style={{ color: 'var(--brass-300)' }}><m.icone className="icon" /></span>
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.25, display: 'block' }}>{m.nome}</span>
            <span className="xs" style={{ fontSize: 11, lineHeight: 1.45, marginTop: 5, display: 'block', minHeight: '3.2em' }}>
              {m.descricao}
            </span>
            <span className="mod-fase">{m.fase}</span>
          </a>
        ))}
      </div>

      <div className="card" style={{ marginTop: 36, padding: 22 }}>
        <span className="label">Jornada de questões</span>
        <p className="body" style={{ marginTop: 10 }}>
          Experimente a navegação da interface usando duas perguntas fictícias,
          sem correção, pontuação ou registro de tentativa.
        </p>
        <a className="btn btn-ghost btn-sm" href="#/jornada" style={{ marginTop: 14 }}>
          Experimentar interface de questões <IcArrow className="icon-sm" />
        </a>
      </div>
      <div style={{ marginTop: 64 }}><Disclaimer variant="box" /></div>
    </div>
  );
}

/* ============================ PÁGINA DE MÓDULO =========================== */
export function ModuloPage({ id }: { id: string }) {
  const m = MODULOS.find((x) => x.id === id);
  if (!m) return <div className="shell page"><h1 className="display-md">Módulo não encontrado</h1><a className="btn btn-ghost btn-sm" href="#/ecossistema">Voltar</a></div>;
  return (
    <div className="shell page">
      <a className="btn btn-ghost btn-sm" href="#/ecossistema">← Ecossistema</a>
      <div className="between wrap" style={{ gap: 28, marginTop: 26, alignItems: 'flex-start' }}>
        <div style={{ maxWidth: '52ch' }}>
          <div className="row" style={{ gap: 12 }}>
            <span className="num" style={{ fontSize: 13, color: 'var(--brass-500)' }}>{String(m.n).padStart(2, '0')}</span>
            <span className="label">{m.fase}</span>
          </div>
          <h1 className="display-lg" style={{ marginTop: 12 }}>{m.nome}</h1>
          <p className="lede" style={{ marginTop: 14 }}>{m.descricao}</p>
          <div className="row wrap" style={{ gap: 10, marginTop: 28 }}>
            <a className="btn btn-brass" href="#/planos">Planos em homologação <IcArrow className="icon-sm" /></a>
            {['simulados','duelo','simulado-adaptativo','caderno-erros'].includes(m.id) && (
              <a className="btn btn-ghost" href="#/jornada">Experimentar interface de questões</a>
            )}
            <a className="btn btn-ghost" href="#/recursos">Ver outros recursos</a>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          <Phone><PhoneChrome titulo={m.curto} idx={0} active>
            <div className="stack" style={{ alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 24 }}>
              <span style={{ color: 'var(--brass-300)' }}><m.icone className="icon icon-lg" /></span>
              <span style={{ fontFamily: 'var(--f-display)', fontSize: 17, textAlign: 'center' }}>{m.curto}</span>
              <span className="xs" style={{ fontSize: 10, textAlign: 'center', maxWidth: '22ch' }}>{m.descricao}</span>
            </div>
          </PhoneChrome></Phone>
        </div>
      </div>

      <hr className="hr" style={{ marginBlock: 64 }} />
      <div className="split-3">
        <div className="stack" style={{ gap: 8 }}>
          <span className="label">O que o módulo faz</span>
          <p className="body" style={{ fontSize: 14 }}>{m.descricao}</p>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <span className="label">A quem se destina</span>
          <p className="body" style={{ fontSize: 14 }}>
            Candidatos ao Exame de Suficiência e contadores em preparação para o EQT e a especialização em auditoria ou perícia.
          </p>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <span className="label">Como se integra</span>
          <p className="body" style={{ fontSize: 14 }}>
            O progresso deste módulo alimenta o Dashboard de Aprovação e determina a prioridade dos flashcards na revisão espaçada.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================== CONCEPTS =============================== */
export function ConceptsIndex() {
  const MAPA: ConceptSpec = {
    eyebrow: 'Mapas Mentais', titulo: 'Mapas Mentais Cânone',
    sub: 'Organize ideias, conecte conceitos e escolha seu melhor caminho de estudo.',
    nota: 'Seis visualizações · um mesmo conteúdo',
    pilares: [
      ['Mapas por disciplina', 'Conteúdos organizados conforme o edital do Exame de Suficiência, com diversos formatos.'],
      ['Escolhas inteligentes', 'Defina o formato, o nível de detalhamento e os tópicos mais relevantes.'],
      ['Favoritos e revisão', 'Salve seus mapas e marque o que precisa revisar de novo.'],
      ['Desempenho visual', 'Acompanhe sua evolução com estatísticas claras.'],
    ],
    telas: [
      { titulo: 'Mapas', corpo: <PList filtro={['Todos', 'Favoritos', 'Por disciplina']} items={[
        { t: 'Contabilidade Geral', s: '24 mapas mentais', p: 62 },
        { t: 'Auditoria', s: '18 mapas mentais', p: 45 },
        { t: 'Legislação e Ética', s: '16 mapas mentais', p: 28 },
        { t: 'CPCs e Normas', s: '22 mapas mentais', p: 55 },
        { t: 'Simulados', s: '12 mapas mentais', p: 12 },
      ]} /> },
      { titulo: 'Formato', corpo: <POptions titulo="Escolha o formato" sub="Selecione o formato ideal para o seu objetivo de estudo." itens={[
        'Mapa radial', 'Fluxograma', 'Linha do tempo', 'Quadro comparativo', 'Checklist visual',
      ]} /> },
      { titulo: 'Mapa', corpo: <PMap centro="Balanço Patrimonial" ramos={[
        { t: 'Ativo', c: '' }, { t: 'Passivo', c: '' }, { t: 'CPC 00', c: '' }, { t: 'Patrimônio Líquido', c: '' },
        { t: 'Receitas', c: '' }, { t: 'Despesas', c: '' },
      ]} /> },
      { titulo: 'Personalizar', corpo: <POptions titulo="Personalizar Estudo" sub="Configure o seu mapa mental." itens={[
        'Básico', 'Intermediário', 'Avançado',
      ]} /> },
      { titulo: 'Progresso', corpo: <PProgresso pct={78} legenda="mapas concluídos de 15" dias={[20, 40, 35, 60, 85, 70, 45]} /> },
    ],
  };

  const ILUSTRADA: ConceptSpec = {
    eyebrow: 'Contabilidade Ilustrada', titulo: 'Contabilidade Ilustrada',
    sub: 'Aprenda conceitos contábeis com explicações visuais, exemplos práticos e resumos inteligentes.',
    nota: 'Conceitos complexos explicados de forma simples',
    pilares: [
      ['Conceitos visuais', 'Diagramas e ilustrações que tornam a contabilidade mais simples e intuitiva.'],
      ['Comparações inteligentes', 'Conceitos lado a lado para entender as diferenças com mais clareza.'],
      ['Favoritos e revisão', 'Salve as aulas mais importantes e revise sempre que precisar.'],
      ['Desempenho claro', 'Acompanhe seu progresso e identifique seus pontos de evolução.'],
    ],
    telas: [
      { titulo: 'Aulas', corpo: <PList filtro={['Todos', 'Favoritos', 'Por disciplina']} items={[
        { t: 'Balanço Patrimonial', s: 'Estrutura, composição e análise', p: 48 },
        { t: 'DRE', s: 'Entenda a formação do resultado passo a passo', p: 36 },
        { t: 'Partidas Dobradas', s: 'Lógica e lançamentos ilustrados', p: 27 },
        { t: 'Ativo x Passivo', s: 'Conceitos, diferenças e exemplos', p: 35 },
        { t: 'CPCs e Normas', s: 'Principais normas contábeis', p: 19 },
      ]} /> },
      { titulo: 'Formato', corpo: <POptions titulo="Formato da aula" sub="Escolha como você quer aprender este conteúdo." itens={[
        'Resumo ilustrado', 'Quadro comparativo', 'Fluxograma', 'Linha do tempo', 'Checklist visual',
      ]} /> },
      { titulo: 'Resumo', corpo: <PCompare a="ATIVO" b="PASSIVO" /> },
      { titulo: 'Comparar', corpo: <PCompare a="ATIVO" b="PASSIVO" /> },
      { titulo: 'Progresso', corpo: <PProgresso pct={68} legenda="do curso" dias={[15, 30, 55, 45, 70, 60, 92]} /> },
    ],
  };

  const GUIA: ConceptSpec = {
    eyebrow: 'Guia de Bolso', titulo: 'Guia de Bolso',
    sub: 'Acesse resumos essenciais, conceitos-chave e consultas rápidas para estudar em qualquer lugar.',
    nota: 'Mais que aprovação. Um novo padrão.',
    pilares: [
      ['Consultas rápidas', 'Resumos objetivos para revisão imediata.'],
      ['Escolhas inteligentes', 'Diferentes formatos para cada necessidade.'],
      ['Favoritos e offline', 'Salve o que importa e acesse onde estiver.'],
      ['Evolução prática', 'Acompanhe o que você já revisou.'],
    ],
    telas: [
      { titulo: 'Biblioteca', corpo: <PList filtro={['Todos', 'Favoritos', 'Por tema']} items={[
        { t: 'Balanço Patrimonial', s: 'Estrutura, contas e principais', p: 62 },
        { t: 'DRE', s: 'Composição, análise e pontos', p: 40 },
        { t: 'Ativo x Passivo', s: 'Classificação e exemplos', p: 55 },
        { t: 'CPCs Essenciais', s: 'Principais normas para o exame', p: 38 },
        { t: 'Auditoria', s: 'Conceitos, procedimentos e pontos-chave', p: 28 },
      ]} /> },
      { titulo: 'Formato', corpo: <POptions titulo="Escolha o formato" sub="Selecione o formato ideal para o seu objetivo de estudo." itens={[
        'Resumo rápido', 'Checklist', 'Tabela comparativa', 'Passo a passo', 'Perguntas frequentes', 'Mapa visual',
      ]} /> },
      { titulo: 'Resumo', corpo: <PCompare a="ATIVO" b="PASSIVO" /> },
      { titulo: 'Personalizar', corpo: <POptions titulo="Personalizar Guia" sub="Ajuste o conteúdo de acordo com a sua necessidade." itens={[
        'Básico', 'Intermediário', 'Avançado',
      ]} /> },
      { titulo: 'Progresso', corpo: <PProgresso pct={72} legenda="do guia revisado" dias={[10, 25, 60, 35, 80, 45, 30]} /> },
    ],
  };

  return (
    <div>
      <ConceptFlashcards variant="escuro" />
      <Home variant="escuro" />
      <ConceptShowcase spec={MAPA} idx="mapas" />
      <ConceptShowcase spec={ILUSTRADA} idx="ilustrada" />
      <ConceptShowcase spec={GUIA} idx="guia" />
      <ConceptFlashcards variant="claro" />
      <Home variant="claro" />
      <Ecossistema />
      <Conteudos />
    </div>
  );
}

export { StatStrip };