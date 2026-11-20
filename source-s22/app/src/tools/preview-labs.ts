/** S19 — laboratórios locais demonstrativos. Sem gabarito, nota, ranking, identidade ou rede. */
import type { PersonalQuestion, PracticeCode } from './personal-practice';
export const LAB_IDS = ['duelo','simulado-adaptativo','podcast','videodulas','offline'] as const;
export type LabId = typeof LAB_IDS[number];
export const isLabId = (id:string):id is LabId => (LAB_IDS as readonly string[]).includes(id);
export type Participant = 'A' | 'B';
export type Duel = {
  kind:'local-duel'; items:ReadonlyArray<PersonalQuestion>; questionIds:readonly number[]; index:number; turn:Participant;
  responses:Readonly<Record<string,Readonly<Partial<Record<Participant,PracticeCode>>>>>;
};
export type Adaptive = {
  kind:'self-reported-revision'; topic:string; items:ReadonlyArray<PersonalQuestion>; pending:readonly number[];
  reviewed:Readonly<Record<string,'rever'|'seguir'>>;
};
const verifyBank=(bank:readonly PersonalQuestion[])=>{
  if(bank.length>60)throw Error('Banco autoral fora do limite (60).');
  const ids=new Set<number>();
  for(const q of bank){
    if(!Number.isSafeInteger(q.id)||q.id<1||ids.has(q.id)||q.provenance!=='user-authored-unverified')throw Error('Banco de questões inválido ou sem proveniência autoral.');
    if(typeof q.topic!=='string'||!q.topic.trim()||typeof q.stem!=='string'||!q.stem.trim())throw Error('Questão incompleta.');
    if(!q.options || (['A','B','C','D'] as const).some(c=>typeof q.options[c]!=='string'||!q.options[c].trim()))throw Error('Alternativas incompletas.');
    ids.add(q.id);
  }
};
const participant=(p:Participant)=>p==='A'||p==='B';
const choice=(v:PracticeCode)=>['A','B','C','D'].includes(v);
export function startDuel(bank:readonly PersonalQuestion[],limit=5):Duel {
  verifyBank(bank);
  if(!Number.isSafeInteger(limit)||limit<1||limit>10)throw Error('Selecione de 1 a 10 questões.');
  if(!bank.length)throw Error('Cadastre questões no Banco Pessoal antes de iniciar.');
  const items=bank.slice(0,limit).map(q=>({...q,options:{...q.options}}));
  return {kind:'local-duel',items,questionIds:items.map(q=>q.id),index:0,turn:'A',responses:{}};
}
export function respondDuel(s:Duel,person:Participant,code:PracticeCode):Duel {
  if(s.kind!=='local-duel'||!participant(person)||!choice(code))throw Error('Resposta inválida.');
  const id=s.questionIds[s.index];
  if(id===undefined||s.index<0||s.index>=s.questionIds.length)throw Error('Duelo encerrado.');
  if(s.turn!==person)throw Error('Não é a vez deste participante.');
  const past=s.responses[String(id)]||{};
  if(past[person])throw Error('Esta resposta já foi registrada.');
  const next={...s.responses,[String(id)]:{...past,[person]:code}};
  if(person==='A')return {...s,turn:'B',responses:next};
  return {...s,turn:'A',index:s.index+1,responses:next};
}
export function duelSummary(s:Duel){
  if(s.kind!=='local-duel')throw Error('Sessão inválida.');
  let completed=0,divergent=0;
  for(const id of s.questionIds){const p=s.responses[String(id)];if(p?.A&&p?.B){completed++;if(p.A!==p.B)divergent++}}
  return {completed,total:s.questionIds.length,divergent,correct:null,winner:null};
}
export function startAdaptive(bank:readonly PersonalQuestion[],topic=''):Adaptive {
  verifyBank(bank);
  if(typeof topic!=='string'||topic.length>100)throw Error('Filtro inválido.');
  const pool=bank.filter(q=>!topic||q.topic===topic);
  if(!pool.length)throw Error('Cadastre questões autorais do tema selecionado.');
  const items=pool.slice(0,20).map(q=>({...q,options:{...q.options}}));
  return {kind:'self-reported-revision',topic,items,pending:items.map(q=>q.id),reviewed:{}};
}
export function reviewAdaptive(s:Adaptive,id:number,decision:'rever'|'seguir'):Adaptive {
  if(s.kind!=='self-reported-revision'||!['rever','seguir'].includes(decision))throw Error('Decisão inválida.');
  if(s.pending[0]!==id)throw Error('Esta questão não está no início da fila.');
  if(s.reviewed[String(id)])throw Error('Questão já revisada nesta sessão.');
  return {...s,pending:s.pending.slice(1),reviewed:{...s.reviewed,[String(id)]:decision}};
}
export function adaptiveSummary(s:Adaptive){
  if(s.kind!=='self-reported-revision')throw Error('Sessão inválida.');
  const decisions=Object.values(s.reviewed);
  return {reviewed:decisions.length,pending:s.pending.length,revisit:decisions.filter(v=>v==='rever').length,score:null,mastery:null};
}
export type MediaKind='podcast'|'videodulas'|'offline';
export type Note={id:number;kind:MediaKind;title:string;body:string;provenance:'user-authored-unverified'};
const clean=(s:string,name:string,min:number,max:number)=>{
  if(typeof s!=='string')throw Error(name+' deve ser texto.');
  const t=s.trim();if(t.length<min||t.length>max)throw Error(name+': '+min+' a '+max+' caracteres.');return t;
};
export function addNote(notes:readonly Note[],kind:MediaKind,title:string,body:string):Note[]{
  if(!(['podcast','videodulas','offline'] as string[]).includes(kind))throw Error('Módulo inválido.');
  if(notes.length>=45||notes.filter(n=>n.kind===kind).length>=15)throw Error('Limite: 15 por módulo / 45 na sessão.');
  const id=Math.max(0,...notes.map(n=>n.id))+1;
  return [...notes,{id,kind,title:clean(title,'Título',3,100),body:clean(body,'Texto',10,3000),provenance:'user-authored-unverified'}];
}
export function removeNote(notes:readonly Note[],kind:MediaKind,id:number):Note[]{
  if(!Number.isSafeInteger(id)||!notes.some(n=>n.kind===kind&&n.id===id))throw Error('Nota ausente ou pertencente a outro módulo.');
  return notes.filter(n=>n.id!==id);
}
export function exportLocalNotes(notes:readonly Note[],kind:MediaKind):string{
  if(!(['podcast','videodulas','offline'] as string[]).includes(kind))throw Error('Módulo inválido.');
  if(notes.length>45)throw Error('Limite excedido.');
  if(notes.some(n=>!(['podcast','videodulas','offline'] as string[]).includes(n.kind)))throw Error('Módulo de nota inválido.');
  const filtered=notes.filter(n=>n.kind===kind);
  if(filtered.length>15||new Set(filtered.map(n=>n.id)).size!==filtered.length)throw Error('Notas duplicadas ou excesso.');
  for(const n of filtered){if(!Number.isSafeInteger(n.id)||n.id<=0||n.provenance!=='user-authored-unverified')throw Error('Proveniência inválida.');clean(n.title,'Título',3,100);clean(n.body,'Texto',10,3000)}
  return JSON.stringify({schema:'canone.preview.user-notes.s19',kind,authority:'user-authored-unverified',stored:'memory-only',items:filtered},null,2);
}
/** Só itens autorais/sintéticos e notas desta sessão; nunca tentativas/gabaritos do backend. */
export function exportSessionSnapshot(data:{bank:readonly PersonalQuestion[],notes:readonly Note[]}):string {
  verifyBank(data.bank);
  for(const kind of ['podcast','videodulas','offline'] as const)exportLocalNotes(data.notes,kind);
  const snapshot={schema:'canone.preview.session.s19',authority:'UNVERIFIED',scope:'memory-only',bank:data.bank,notes:data.notes};
  const json=JSON.stringify(snapshot,null,2);
  if(json.length>600000)throw Error('Pacote de exportação excede o limite.');
  return json;
}
