-- Cânone V6: consultas somente leitura do Supabase Calculadoras-Smart.
-- Política: nenhuma tabela de Enfermagem, nenhuma DML/DDL, não expor Storage paths.
-- Relatório 1: integridade de 249 trios normativos e gates.
WITH x AS (
 SELECT e.instrument_id, e.raw_evidence_id, e.raw_sha256, e.raw_byte_count,
        e.text_sha256,e.mask_sha256, e.text_storage_bucket,e.text_storage_path,
        e.mask_storage_bucket,e.mask_storage_path,
        a.sha256 AS acquisition_sha256, a.byte_count AS acquisition_bytes,
        a.gate_status,a.promotion_eligible,e.canonical_promotion,e.publication_mode,
        a.raw_payload->>'storage_bucket' AS raw_bucket,
        a.raw_payload->>'storage_path' AS raw_path
 FROM account_palm.normative_extractions e
 JOIN account_palm.acquisition_evidence a ON a.evidence_id=e.raw_evidence_id
 WHERE e.instrument_id LIKE 'CFC-%'
)
SELECT count(*) AS sources, count(DISTINCT x.instrument_id) AS unique_instruments,
       count(DISTINCT x.raw_sha256) AS unique_original_digests,
       count(*) FILTER (WHERE x.raw_sha256 IS DISTINCT FROM x.acquisition_sha256 OR
         x.raw_byte_count IS DISTINCT FROM x.acquisition_bytes) AS declared_hash_or_byte_conflicts,
       count(*) FILTER (WHERE x.gate_status <> 'BLOCKED' OR x.promotion_eligible IS TRUE OR
         x.canonical_promotion IS TRUE OR x.publication_mode <> 'INTERNAL_ONLY') AS promotion_anomalies,
       count(*) FILTER (WHERE coalesce(x.text_sha256,'') !~ '^[0-9a-f]{64}$' OR
         coalesce(x.mask_sha256,'') !~ '^[0-9a-f]{64}$' OR
         coalesce(x.raw_sha256,'') !~ '^[0-9a-f]{64}$') AS malformed_digests,
       count(*) FILTER (WHERE orig.id IS NULL OR txt.id IS NULL OR mask.id IS NULL) AS missing_storage_objects
FROM x
LEFT JOIN storage.objects orig ON orig.bucket_id=x.raw_bucket AND orig.name=x.raw_path
LEFT JOIN storage.objects txt ON txt.bucket_id=x.text_storage_bucket AND txt.name=x.text_storage_path
LEFT JOIN storage.objects mask ON mask.bucket_id=x.mask_storage_bucket AND mask.name=x.mask_storage_path;

-- Relatório 2: cinco instrumentos reais, estratificados por bytes do PDF;
-- a seleção NÃO contém nem publica os caminhos privados do bucket.
WITH ranked AS (
 SELECT instrument_id,raw_byte_count::bigint AS original_bytes,
        ntile(5) OVER (ORDER BY raw_byte_count::bigint,instrument_id) AS stratum
 FROM account_palm.normative_extractions
 WHERE instrument_id LIKE 'CFC-%'
), candidates AS (
 SELECT *,row_number() OVER (PARTITION BY stratum ORDER BY original_bytes,instrument_id) AS position
 FROM ranked
)
SELECT stratum,instrument_id,original_bytes
FROM candidates WHERE position=1 ORDER BY stratum;
