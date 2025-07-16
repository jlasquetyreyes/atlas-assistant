{{
  config(
    materialized='table'
  )
}}

-- Get your existing diff history
WITH standard_diffs AS (
  SELECT
    change_id,
    block_id,
    change_type,
    previous_snapshot_time,
    current_snapshot_time,
    old_text,
    new_text,
    old_parent,
    new_parent,
    old_type,
    new_type,
    NULL AS confidence_level,
    'snapshot' AS detection_method
  FROM {{ ref('diff_history') }}
),

-- Format deletion events to match diff history structure
deletion_diffs AS (
  SELECT
    'deleted_' || block_id::text || '_' || TO_CHAR(detected_at, 'YYYYMMDD_HH24MISS') AS change_id,
    block_id::text AS block_id,
    'deleted' AS change_type,
    last_seen_at AS previous_snapshot_time,
    detected_at AS current_snapshot_time,
    last_known_text AS old_text,
    NULL AS new_text,
    last_known_parent_id::text AS old_parent,
    NULL AS new_parent,
    last_known_block_type AS old_type,
    NULL AS new_type,
    confidence_level,
    'registry' AS detection_method
  FROM {{ ref('deletion_events_generator') }}
  WHERE confidence_level IN ('likely', 'confirmed')  -- Only include higher confidence deletions
)

-- Combine standard diffs with deletion events
SELECT * FROM (
  SELECT * FROM standard_diffs
  UNION ALL
  SELECT * FROM deletion_diffs
) combined_diffs
ORDER BY
  COALESCE(current_snapshot_time, previous_snapshot_time) DESC,
  change_type,
  block_id
