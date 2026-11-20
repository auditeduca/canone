/** S16 — conteúdo AUTORAL do usuário em sessão de prévia, não validado por normativos. */
export type KnowledgeKind = 'mapas-mentais' | 'guia-de-bolso' | 'glossario' | 'casos';
export type KnowledgeItem = {
 id: number;
 kind: KnowledgeKind;
 title: string;
 body: string;
 reference: string;
 parentId: number | null;
};
const kinds: readonly KnowledgeKind[]=['mapas-mentais','guia-de-bolso','glossario','casos'];
function clean(value: string, max: number, label: string, required: boolean) {
 if(typeof value!=='string')throw Error(`${label}: texto inválido.`);
 const v=value.trim().replace(/\s+/g,' ');
 if((required&&!v)||v.length>max)throw Error(`${label}: ${required?'informe de 1 a ': 'máximo de '}${max} caracteres.`);
 return v;
}
export function createKnowledgeItem(
 id:number, kind: KnowledgeKind, title:string, body:string, reference:string,
 parentId:number|null, existing:readonly KnowledgeItem[]
):KnowledgeItem {
 if(!Number.isSafeInteger(id)||id<1||existing.some(x=>x.id===id))throw Error('Identificador duplicado ou inválido.');
 if(!kinds.includes(kind))throw Error('Tipo de documento inválido.');
 const parent=kind==='mapas-mentais'?parentId:null;
 if(parent!==null&&(!Number.isSafeInteger(parent)||parent<1||!existing.some(x=>x.id===parent&&x.kind===kind)))throw Error('Nó superior inexistente.');
 return {id,kind,title:clean(title,160,'Título',true),body:clean(body,1500,'Descrição',false),reference:clean(reference,400,'Referência',false),parentId:parent};
}
export function removeKnowledgeItem(items:readonly KnowledgeItem[],id:number):KnowledgeItem[] {
 const ids=new Set([id]);let priorSize=-1;
 while(priorSize!==ids.size){priorSize=ids.size;for(const item of items){if(item.parentId!==null&&ids.has(item.parentId))ids.add(item.id)}}
 return items.filter(item=>!ids.has(item.id));
}
export function mapOutline(items:readonly KnowledgeItem[]):Array<{id:number;depth:number;title:string;body:string}> {
 const nodes=items.filter(item=>item.kind==='mapas-mentais');
 const byParent=new Map<number|null,KnowledgeItem[]>();
 for(const item of nodes){const key=item.parentId;byParent.set(key,[...(byParent.get(key)||[]),item]);}
 const seen=new Set<number>(),result:Array<{id:number;depth:number;title:string;body:string}>=[];
 function visit(parent:number|null, depth:number){
  if(depth>40)throw Error('Mapa excedeu o limite de profundidade.');
  for(const item of byParent.get(parent)||[]){if(seen.has(item.id))throw Error('Referência circular no mapa.');seen.add(item.id);result.push({id:item.id,depth,title:item.title,body:item.body});visit(item.id,depth+1)}
 }
 visit(null,0);
 if(seen.size!==nodes.length)throw Error('Mapa contém nós órfãos ou referências circulares.');
 return result;
}
export function knowledgeCounts(items:readonly KnowledgeItem[]):Record<KnowledgeKind,number>{
 return Object.fromEntries(kinds.map(kind=>[kind,items.filter(item=>item.kind===kind).length])) as Record<KnowledgeKind,number>;
}
