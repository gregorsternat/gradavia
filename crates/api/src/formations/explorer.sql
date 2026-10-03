-- Parameters: release, campaign, search, type, region, department, status,
-- selectivity, page. Every statement stays pinned to the captured release.
WITH descriptive AS MATERIALIZED (
  SELECT row_number,
    coalesce(nullif(btrim(payload->>'lib_for_voe_ins'), ''),
      (SELECT string_agg(label, ' — ' ORDER BY position) FROM (
        SELECT label, min(position) AS position FROM unnest(ARRAY[
          nullif(btrim(payload->>'form_lib_voe_acc'), ''),
          nullif(btrim(payload->>'fil_lib_voe_acc'), ''),
          nullif(btrim(payload->>'detail_forma'), '')
        ]) WITH ORDINALITY labels(label, position) WHERE label IS NOT NULL GROUP BY label
      ) labels), 'Intitulé non renseigné') AS title,
    nullif(btrim(payload->>'g_ea_lib_vx'), '') AS establishment,
    nullif(btrim(payload->>'ville_etab'), '') AS city,
    nullif(btrim(payload->>'dep_lib'), '') AS departement,
    nullif(btrim(payload->>'region_etab_aff'), '') AS region,
    nullif(btrim(payload->>'fili'), '') AS type,
    nullif(btrim(payload->>'contrat_etab'), '') AS statut,
    CASE btrim(payload->>'select_form')
      WHEN 'formation selective' THEN 'Sélective' WHEN 'formation sélective' THEN 'Sélective'
      WHEN 'formation non selec' THEN 'Non sélective' WHEN 'formation non sélective' THEN 'Non sélective'
      ELSE nullif(btrim(payload->>'select_form'), '') END AS selectivite,
    payload->>'lien_form_psup' AS parcoursup_url, payload AS raw_payload
  FROM raw_records WHERE release_id = $1::uuid AND campaign = $2
), searchable AS (
  SELECT *,
    replace(replace(lower(regexp_replace(normalize(concat_ws(' ', title, establishment, city, departement, region), NFD), '[' || chr(768) || '-' || chr(879) || ']', '', 'g')), 'œ', 'oe'), 'æ', 'ae') AS search_text,
    replace(replace(lower(regexp_replace(normalize(title, NFD), '[' || chr(768) || '-' || chr(879) || ']', '', 'g')), 'œ', 'oe'), 'æ', 'ae') AS sort_title,
    replace(replace(lower(regexp_replace(normalize(establishment, NFD), '[' || chr(768) || '-' || chr(879) || ']', '', 'g')), 'œ', 'oe'), 'æ', 'ae') AS sort_establishment
  FROM descriptive
), words AS (
  SELECT word FROM regexp_split_to_table(
    replace(replace(lower(regexp_replace(normalize($3::text, NFD), '[' || chr(768) || '-' || chr(879) || ']', '', 'g')), 'œ', 'oe'), 'æ', 'ae'), '\s+'
  ) word WHERE word <> ''
), filtered AS MATERIALIZED (
  SELECT * FROM searchable
  WHERE ($4 = '' OR type = $4) AND ($5 = '' OR region = $5)
    AND ($6 = '' OR departement = $6) AND ($7 = '' OR statut = $7)
    AND ($8 = '' OR selectivite = $8)
    AND NOT EXISTS (
      SELECT 1 FROM words WHERE search_text NOT LIKE
        '%' || replace(replace(replace(word, '!', '!!'), '%', '!%'), '_', '!_') || '%' ESCAPE '!'
    )
), ranked AS (
  SELECT *, CASE WHEN btrim(raw_payload->>(CASE $10 WHEN 'capacite' THEN 'capa_fin' WHEN 'candidatures' THEN 'voe_tot' WHEN 'admis' THEN 'acc_tot' WHEN 'acces' THEN 'taux_acces_ens' END)) ~ CASE $10 WHEN 'acces' THEN '^\d+(\.\d+)?$' ELSE '^\d+(\.0+)?$' END
    THEN CASE WHEN (raw_payload->>(CASE $10 WHEN 'capacite' THEN 'capa_fin' WHEN 'candidatures' THEN 'voe_tot' WHEN 'admis' THEN 'acc_tot' WHEN 'acces' THEN 'taux_acces_ens' END))::numeric BETWEEN 0 AND (CASE $10 WHEN 'acces' THEN 100 ELSE 9007199254740991 END)
    THEN (raw_payload->>(CASE $10 WHEN 'capacite' THEN 'capa_fin' WHEN 'candidatures' THEN 'voe_tot' WHEN 'admis' THEN 'acc_tot' WHEN 'acces' THEN 'taux_acces_ens' END))::numeric END END AS sort_metric
  FROM filtered
), totals AS (
  SELECT count(*)::int AS total,
    least($9::int, greatest(1, (count(*)::int + 24) / 25)) AS page FROM filtered
), paged AS (
  SELECT * FROM ranked ORDER BY sort_metric DESC NULLS LAST, sort_title COLLATE "C", sort_establishment COLLATE "C" NULLS LAST, row_number
  LIMIT 25 OFFSET (SELECT (page - 1) * 25 FROM totals)
)
SELECT total, page,
  (SELECT coalesce(jsonb_agg(to_jsonb(paged) - 'search_text' - 'sort_title' - 'sort_establishment' - 'sort_metric' ORDER BY sort_metric DESC NULLS LAST, sort_title COLLATE "C", sort_establishment COLLATE "C" NULLS LAST, row_number), '[]'::jsonb) FROM paged) AS formations,
  (SELECT jsonb_build_object(
    'type', coalesce(jsonb_agg(DISTINCT type ORDER BY type) FILTER (WHERE type IS NOT NULL), '[]'::jsonb),
    'region', coalesce(jsonb_agg(DISTINCT region ORDER BY region) FILTER (WHERE region IS NOT NULL), '[]'::jsonb),
    'departement', coalesce(jsonb_agg(DISTINCT departement ORDER BY departement) FILTER (WHERE departement IS NOT NULL), '[]'::jsonb),
    'statut', coalesce(jsonb_agg(DISTINCT statut ORDER BY statut) FILTER (WHERE statut IS NOT NULL), '[]'::jsonb),
    'selectivite', coalesce(jsonb_agg(DISTINCT selectivite ORDER BY selectivite) FILTER (WHERE selectivite IS NOT NULL), '[]'::jsonb)
  ) FROM descriptive) AS facets
FROM totals
