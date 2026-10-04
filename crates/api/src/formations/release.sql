SELECT r.id::text AS release_id, d.id AS dataset_id, r.campaigns,
  to_char(r.collected_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS collected_at,
  to_char(r.source_modified_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS modified_at,
  r.license,
  coalesce(nullif(btrim(r.metadata #>> '{metas,default,publisher}'), ''), d.provider) AS provider,
  (SELECT jsonb_agg(f->>'name') FROM jsonb_array_elements(r.metadata->'fields') f) AS fields
FROM source_datasets d JOIN source_releases r ON r.dataset_id = d.id
WHERE d.family = 'parcoursup' AND d.id = ANY($1)
AND r.id = $2::uuid
ORDER BY d.id
