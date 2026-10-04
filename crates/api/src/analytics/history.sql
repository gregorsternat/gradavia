-- One observation per captured campaign, without joining formations across years.
WITH selected AS (
  SELECT release_id::uuid, campaign FROM unnest($1::text[], $2::int[]) AS s(release_id, campaign)
), extracted AS MATERIALIZED (
  SELECT s.campaign, r.payload->>'capa_fin' AS capacity, r.payload->>'acc_tot' AS admitted
  FROM selected s JOIN raw_records r ON r.release_id = s.release_id AND r.campaign = s.campaign
), values AS (
  SELECT campaign,
    CASE WHEN btrim(capacity) ~ '^\d+(\.0+)?$'
      THEN CASE WHEN (capacity)::numeric <= 9007199254740991 THEN (capacity)::double precision END END AS capacity,
    CASE WHEN btrim(admitted) ~ '^\d+(\.0+)?$'
      THEN CASE WHEN (admitted)::numeric <= 9007199254740991 THEN (admitted)::double precision END END AS admitted
  FROM extracted
)
SELECT campaign, count(*) AS formations, sum(capacity) AS capacity, count(capacity) AS capacity_observed,
  sum(admitted) AS admitted, count(admitted) AS admitted_observed
FROM values GROUP BY campaign ORDER BY campaign
