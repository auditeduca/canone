import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Nav, Footer } from './ui/Nav';
import { FerramentasFinanceiras } from './screens/FerramentasFinanceiras';
import { LOCAL_IDS, LocalModules, type LocalModuleId } from './screens/LocalModules';
import { KNOWLEDGE_IDS, KnowledgeModules } from './screens/KnowledgeModules';
import { SYNTHETIC_ENTRIES, type JournalEntry } from './tools/synthetic-ledger';
import type { StudyCard, StudyTask } from './tools/local-learning';
import type { KnowledgeItem, KnowledgeKind } from './tools/personal-knowledge';
import { PersonalPractice } from './screens/PersonalPractice';
import type { PersonalQuestion, PracticeSession, PracticeMode } from './tools/personal-practice';
import { StudyWorkbenches } from './screens/StudyWorkbenches';
import { WORKBENCH_IDS, type WorkbenchEntry, type WorkbenchDomain } from './tools/study-workbench';
import { LAB_IDS, type LabId, type Duel, type Adaptive, type Note } from './tools/preview-labs';
import { PreviewLabs } from './screens/PreviewLabs';

/** S14: intercepta apenas rotas matemáticas, mantendo todas as outras no App canônico. */
function Root() {
  const [hash, setHash] = useState(() => window.location.hash);
  // Compartilhar estado entre páginas durante esta aba. Sem localStorage, servidor ou cookies.
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([...SYNTHETIC_ENTRIES]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [personalQuestions, setPersonalQuestions] = useState<PersonalQuestion[]>([]);
  const [workbenchEntries, setWorkbenchEntries] = useState<WorkbenchEntry[]>([]);
  const [duel, setDuel] = useState<Duel|null>(null);
  const [adaptive, setAdaptive] = useState<Adaptive|null>(null);
  const [previewNotes, setPreviewNotes] = useState<Note[]>([]);
  const [practiceSessions, setPracticeSessions] = useState<Record<PracticeMode, PracticeSession | null>>({reposicao:null, simulados:null});
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const origin = hash === '#/modulo/calculadoras' ? 'calculadoras'
    : hash === '#/modulo/matematica' ? 'matematica' : null;
  const localId = hash.startsWith('#/modulo/') ? hash.replace('#/modulo/', '') : '';
  const isLocal = LOCAL_IDS.some(id => id === localId);
  const isKnowledge = KNOWLEDGE_IDS.some(id => id === localId);
  const isPractice = localId === 'reposicao' || localId === 'simulados';
  const isWorkbench = WORKBENCH_IDS.some(id => id === localId);
  const isLab = LAB_IDS.some(id => id === localId);
  if (!origin && !isLocal && !isKnowledge && !isPractice && !isWorkbench && !isLab) return <App />;
  return <>
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <Nav path={'/modulo/' + (origin ?? localId)} />
    <div role="status" style={{ textAlign: 'center', padding: '8px 12px', background: 'var(--ink-150)', color: 'var(--brass-200)', fontSize: 12, borderBottom: '1px solid var(--line-brass)' }}>
      Ambiente de prévia restrita · Ferramentas locais demonstrativas · Sem login, nota oficial ou pagamentos
    </div>
    <main id="conteudo">{origin ? <FerramentasFinanceiras origin={origin} /> : isLocal ? <LocalModules id={localId as LocalModuleId} session={{cards,setCards,tasks,setTasks,entries,setEntries}} /> : isKnowledge ? <KnowledgeModules id={localId as KnowledgeKind} items={knowledge} setItems={setKnowledge}/> : isWorkbench ? <StudyWorkbenches domain={localId as WorkbenchDomain} entries={workbenchEntries} setEntries={setWorkbenchEntries} /> : isLab ? <PreviewLabs id={localId as LabId} bank={personalQuestions} duel={duel} setDuel={setDuel} adaptive={adaptive} setAdaptive={setAdaptive} notes={previewNotes} setNotes={setPreviewNotes} /> : <PersonalPractice mode={localId as PracticeMode} bank={personalQuestions} setBank={setPersonalQuestions} session={practiceSessions[localId as PracticeMode]} setSession={updater=>setPracticeSessions(old=>({...old,[localId]:typeof updater==='function'?updater(old[localId as PracticeMode]):updater}))} />}</main>
    <Footer />
  </>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
