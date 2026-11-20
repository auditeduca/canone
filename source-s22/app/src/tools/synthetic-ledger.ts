/** Cânone S15: razão didático sintético. NÃO é escrituração/DF conforme CPC/IFRS. */
export const ACCOUNT_DEFS = [
  {id:'caixa',name:'Caixa',kind:'asset'},
  {id:'clientes',name:'Clientes',kind:'asset'},
  {id:'estoque',name:'Estoque',kind:'asset'},
  {id:'fornecedores',name:'Fornecedores',kind:'liability'},
  {id:'capital',name:'Capital fictício',kind:'equity'},
  {id:'receita',name:'Receita fictícia',kind:'revenue'},
  {id:'despesa',name:'Despesa fictícia',kind:'expense'},
] as const;
export type AccountId = typeof ACCOUNT_DEFS[number]['id'];
export type JournalEntry = { id: number; label: string; debit: AccountId; credit: AccountId; amountCents: number };
export const SYNTHETIC_ENTRIES: JournalEntry[] = [
 {id:1,label:'Capital demonstrativo',debit:'caixa',credit:'capital',amountCents:1000000},
 {id:2,label:'Receita sintética à vista',debit:'caixa',credit:'receita',amountCents:150000},
 {id:3,label:'Despesa sintética à vista',debit:'despesa',credit:'caixa',amountCents:40000},
 {id:4,label:'Compra sintética a prazo',debit:'estoque',credit:'fornecedores',amountCents:100000},
];
const validIds = new Set<string>(ACCOUNT_DEFS.map(account => account.id));
export function createJournalEntry(id:number,label:string,debit:string,credit:string,amountReais:number):JournalEntry {
 if(!Number.isSafeInteger(id)||id<1)throw new Error('ID inválido.');
 const name=label.trim().replace(/\s+/g,' ');
 if(name.length<1||name.length>120)throw new Error('Histórico: informe de 1 a 120 caracteres.');
 if(!validIds.has(debit)||!validIds.has(credit)||debit===credit)throw new Error('Selecione contas distintas, válidas.');
 if(!Number.isFinite(amountReais)||amountReais<=0||amountReais>100000000)throw new Error('Valor fora do intervalo permitido.');
 const cents=Math.round(amountReais*100);
 if(!Number.isSafeInteger(cents))throw new Error('Valor fora do intervalo permitido.');
 return {id,label:name,debit:debit as AccountId,credit:credit as AccountId,amountCents:cents};
}
export function projectJournal(entries:readonly JournalEntry[]){
 const cents=Object.fromEntries(ACCOUNT_DEFS.map(a=>[a.id,0])) as Record<AccountId,number>;
 let debitTotal=0,creditTotal=0;
 for(const entry of entries){
  if(!validIds.has(entry.debit)||!validIds.has(entry.credit)||entry.debit===entry.credit||!Number.isSafeInteger(entry.amountCents)||entry.amountCents<=0)throw new Error('Lançamento inválido no diário.');
  cents[entry.debit]+=entry.amountCents;
  cents[entry.credit]-=entry.amountCents;
  debitTotal+=entry.amountCents;
  creditTotal+=entry.amountCents;
 }
 // Débito positivo para classes do ativo/despesa, crédito positivo para demais.
 const debitNet=(id:AccountId)=>cents[id];
 const creditNet=(id:AccountId)=>-cents[id];
 const assets=debitNet('caixa')+debitNet('clientes')+debitNet('estoque');
 const liabilities=creditNet('fornecedores');
 const equity=creditNet('capital');
 const revenues=creditNet('receita');
 const expenses=debitNet('despesa');
 const result=revenues-expenses;
 return {cents,assets,liabilities,equity,revenues,expenses,result,debitTotal,creditTotal,
  balanced:debitTotal===creditTotal&&assets===liabilities+equity+result,
  lines:ACCOUNT_DEFS.map(def=>({...def,netCents:def.kind==='asset'||def.kind==='expense'?debitNet(def.id):creditNet(def.id)}))};
}
