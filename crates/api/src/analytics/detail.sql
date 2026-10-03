-- Parameters: release, campaign, search, type, region, department, status,
-- selectivity, page. Every statement stays pinned to the captured release.
WITH descriptive AS MATERIALIZED (
  SELECT row_number, campaign,
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
  FROM raw_records WHERE release_id = $1::uuid AND row_number = $2
) SELECT campaign, to_jsonb(descriptive) AS formation,
  (SELECT metadata FROM source_releases WHERE id = $1::uuid) AS metadata FROM descriptive
