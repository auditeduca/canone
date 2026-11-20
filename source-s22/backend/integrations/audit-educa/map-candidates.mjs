import {createHash} from 'node:crypto';

export const sha256 = value => createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export const makeKey = (source,sourceId) => sha256(`${source}:${String(sourceId)}`);

// Nenhum objeto desta camada é publicável. O estado aqui NUNCA substitui a
// aprovação de domínio e as constraints de publicação do PostgreSQL Cânone.
export function mapCandidate(contractItem, row) {
  const originalId = row[contractItem.key];
  if (originalId === null || originalId === undefined || String(originalId).trim()==='') {
    throw new Error(`IDENTITY_MISSING ${contractItem.source}.${contractItem.key}`);
  }
  const base = {
    bridge_id:makeKey(contractItem.source,originalId),
    origin:contractItem.source,
    origin_pk:String(originalId),
    destination_candidate:contractItem.target,
    source_kind:contractItem.type,
    provenance:{source_system:'Calculadoras-Smart',source_ref:`${contractItem.source}:${originalId}`,record_sha256:sha256(row),source_scope:'ACCOUNTING_AUDIT'},
    publication_eligible:false,
    import_status:'HOLD_HUMAN',
    gate:contractItem.gate,
  };
  if (contractItem.type === 'QUESTION') {
    const options=row.options;
    if (!options || typeof options!=='object' || Array.isArray(options) ||
      !['A','B','C','D'].every(k=>typeof options[k]==='string' && options[k].trim().length>0)) {
      return {...base,gate:'INVALID_OPTIONS',draft:{source_id:row.source_id,question_number:row.question_number}};
    }
    return {...base, draft:{source_id:row.source_id,question_number:row.question_number,
      statement:row.statement || row.raw_text || null,options:{A:options.A,B:options.B,C:options.C,D:options.D},
      classification:row.classification || {},source_provenance:row.provenance || {},
      answer_status:row.answer_status,extraction_status:row.extraction_status,
      // O gabarito nunca vai para o payload publicável nesta camada.
      official_key_verified:false}};
  }
  if (contractItem.type === 'MASTER_REGISTER') {
    return {...base,draft:{object_id:row.object_id,object_type:row.object_type,category:row.category,
      label:row.label,version:row.version,source_status:row.canonical_status,
      source_scope:row.source_scope,source_ref:row.source_ref,evidence_refs:row.evidence_refs,
      source_canonical_promotion:row.canonical_promotion===true}};
  }
  return {...base,draft:row};
}

export function mapRows(contractItem, rows) {
  const ids=new Set();
  return rows.map(row => {
    const candidate=mapCandidate(contractItem,row);
    if(ids.has(candidate.bridge_id))throw new Error(`DUPLICATE_ID ${candidate.origin_pk}`);
    ids.add(candidate.bridge_id);
    return candidate;
  });
}
