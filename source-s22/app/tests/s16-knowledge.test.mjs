import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createKnowledgeItem,removeKnowledgeItem,mapOutline,knowledgeCounts} from '../src/tools/personal-knowledge.ts';
const mk=(id,kind,title,body='',reference='',parentId=null,items=[])=>createKnowledgeItem(id,kind,title,body,reference,parentId,items);
const root=mk(1,'mapas-mentais','Conta');
const child=mk(2,'mapas-mentais','Grupo','Descrição','Fonte A',1,[root]);
const grandchild=mk(3,'mapas-mentais','Subgrupo','','',2,[root,child]);
const glossary=mk(4,'glossario','Termo','Definição informada');
test('S16 accepts 4 canonical user-authored categories',()=>{
 for(const kind of ['mapas-mentais','guia-de-bolso','glossario','casos'])assert.equal(mk(9,kind,'Meu texto').kind,kind);
});
test('S16 refuses unsupported kind',()=>assert.throws(()=>mk(1,'cpc-official','X'),/Tipo/));
test('S16 trims user title and body',()=>{
 const x=mk(1,'guia-de-bolso','  Meu   título ','  texto    pessoal  ');
 assert.equal(x.title,'Meu título');assert.equal(x.body,'texto pessoal');
});
test('S16 disallows empty title',()=>assert.throws(()=>mk(1,'casos',' '),/Título/));
test('S16 caps text length',()=>assert.throws(()=>mk(1,'casos','t','x'.repeat(1501)),/Descrição/));
test('S16 caps references',()=>assert.throws(()=>mk(1,'casos','t','', 'x'.repeat(401)),/Referência/));
test('S16 refuses duplicate ids',()=>assert.throws(()=>mk(1,'casos','y','','',null,[mk(1,'casos','x')]),/duplicado/));
test('S16 refuses nonpositive identifiers',()=>assert.throws(()=>mk(0,'casos','x'),/Identificador/));
test('S16 refuses nonexistent parent',()=>assert.throws(()=>mk(3,'mapas-mentais','x','','',25,[root,child]),/inexistente/));
test('S16 refuses parent from another category',()=>assert.throws(()=>mk(5,'mapas-mentais','x','','',4,[root,glossary]),/inexistente/));
test('S16 ignores parent for non-map entries',()=>assert.equal(mk(9,'casos','x','','',1,[root]).parentId,null));
test('S16 calculates ordered outline depths',()=>assert.deepEqual(mapOutline([root,child,grandchild]).map(x=>[x.title,x.depth]),[['Conta',0],['Grupo',1],['Subgrupo',2]]));
test('S16 rejects orphaned/corrupted maps',()=>assert.throws(()=>mapOutline([{...root,parentId:99}]),/órfãos/));
test('S16 rejects cyclic/corrupted maps',()=>assert.throws(()=>mapOutline([{...root,parentId:2},child]),/órfãos|circular/));
test('S16 removes descendants recursively',()=>assert.deepEqual(removeKnowledgeItem([root,child,grandchild,glossary],1).map(x=>x.id),[4]));
test('S16 leaves other trees untouched',()=>assert.deepEqual(removeKnowledgeItem([root,child,glossary],4).map(x=>x.id),[1,2]));
test('S16 counts only owned category',()=>assert.deepEqual(knowledgeCounts([root,child,glossary]),{'mapas-mentais':2,'guia-de-bolso':0,glossario:1,casos:0}));
test('S16 no network/persistence in author engine',()=>{
 const s=readFileSync(new URL('../src/tools/personal-knowledge.ts',import.meta.url),'utf8');
 assert.doesNotMatch(s,/fetch\(|XMLHttpRequest|supabase|localStorage|sessionStorage|eval\(/);
});
test('S16 session store lifted into routing root',()=>{
 const s=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(s,/const \[cards, setCards\] = useState/);
 assert.match(s,/const \[entries, setEntries\] = useState/);
 assert.match(s,/const \[knowledge, setKnowledge\] = useState/);
 assert.match(s,/session=\{\{cards,setCards,tasks,setTasks,entries,setEntries\}\}/);
});
test('S16 does not claim normative approval',()=>{
 const s=readFileSync(new URL('../src/screens/KnowledgeModules.tsx',import.meta.url),'utf8');
 assert.match(s,/Conteúdo do usuário/);
 assert.match(s,/sem homologação|Não homologado|não afirma/);
 assert.doesNotMatch(s,/gabarito\.correta|gradeAnswer|fetch\(|localStorage|supabase/);
});
