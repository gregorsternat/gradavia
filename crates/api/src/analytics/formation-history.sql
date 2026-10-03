SELECT selected.campaign, candidate.row_number, candidate.payload
FROM unnest($1::text[], $2::int[]) AS selected(release_id, campaign)
CROSS JOIN LATERAL (
  SELECT row_number, payload FROM raw_records
  WHERE release_id = selected.release_id::uuid AND campaign = selected.campaign
    AND payload->>'cod_aff_form' = $3 AND payload->>'cod_uai' = $4
  LIMIT 2
) candidate
