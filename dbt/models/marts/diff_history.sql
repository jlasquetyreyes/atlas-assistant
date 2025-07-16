{{
  config(
    materialized='table'
  )
}}

WITH snapshot_timestamps AS (
  -- Get all distinct snapshot timestamps ordered by time
  SELECT DISTINCT dbt_updated_at as snapshot_time
  FROM {{ ref('snapshot_blocks') }}
  ORDER BY dbt_updated_at
),
snapshot_pairs AS (
  -- Create pairs of consecutive snapshots (earlier -> later)
  SELECT 
    snapshot_time as later_snapshot,  -- This is the MORE RECENT snapshot
    LAG(snapshot_time) OVER (ORDER BY snapshot_time) as earlier_snapshot  -- This is the OLDER snapshot
  FROM snapshot_timestamps
  WHERE snapshot_time IS NOT NULL
),
filtered_snapshot_pairs AS (
  -- Filter out pairs where earlier_snapshot is NULL
  -- Process ALL consecutive snapshot pairs to preserve historical records
  SELECT
    later_snapshot,
    earlier_snapshot
  FROM snapshot_pairs
  WHERE earlier_snapshot IS NOT NULL
),
later_snapshot_blocks AS (
  -- Get blocks from the later snapshot (current)
  SELECT
    s.*,
    sp.earlier_snapshot
  FROM {{ ref('snapshot_blocks') }} s
  JOIN filtered_snapshot_pairs sp ON s.dbt_updated_at = sp.later_snapshot
),
earlier_state_blocks AS (
  -- For each snapshot pair, get the most recent version of each block from ALL previous snapshots
  SELECT DISTINCT ON (sp.later_snapshot, s.block_id)
    s.*,
    sp.later_snapshot,
    sp.earlier_snapshot
  FROM filtered_snapshot_pairs sp
  JOIN {{ ref('snapshot_blocks') }} s ON s.dbt_updated_at <= sp.earlier_snapshot
  ORDER BY sp.later_snapshot, s.block_id, s.dbt_updated_at DESC
),
added AS (
  -- Blocks that exist in current but not in previous snapshot
  SELECT
    'added_' || ls.block_id::text || '_' || TO_CHAR(ls.dbt_updated_at, 'YYYYMMDD_HH24MISS') AS change_id,
    ls.block_id::text AS block_id,
    'added' AS change_type,
    ls.earlier_snapshot AS previous_snapshot_time,  -- Earlier timestamp
    ls.dbt_updated_at AS current_snapshot_time,      -- Later timestamp
    NULL AS old_text,
    ls.text_content AS new_text,
    NULL AS old_parent,
    ls.parent_id::text AS new_parent,
    NULL AS old_type,
    ls.block_type AS new_type
  FROM later_snapshot_blocks ls
  LEFT JOIN earlier_state_blocks es ON ls.block_id = es.block_id
    AND es.later_snapshot = ls.dbt_updated_at
  WHERE es.block_id IS NULL
),
updated AS (
  -- Blocks that exist in both snapshots but have different content (and no parent change)
  SELECT
    'updated_' || ls.block_id::text || '_' || TO_CHAR(ls.dbt_updated_at, 'YYYYMMDD_HH24MISS') AS change_id,
    ls.block_id::text AS block_id,
    'updated' AS change_type,
    es.dbt_updated_at AS previous_snapshot_time,     -- Earlier timestamp
    ls.dbt_updated_at AS current_snapshot_time,      -- Later timestamp
    es.text_content AS old_text,
    ls.text_content AS new_text,
    es.parent_id::text AS old_parent,
    ls.parent_id::text AS new_parent,
    es.block_type AS old_type,
    ls.block_type AS new_type
  FROM later_snapshot_blocks ls
  JOIN earlier_state_blocks es ON ls.block_id = es.block_id
    AND es.later_snapshot = ls.dbt_updated_at
  WHERE es.text_content IS DISTINCT FROM ls.text_content
    AND es.parent_id IS NOT DISTINCT FROM ls.parent_id  -- Only if parent didn't change
),
moved AS (
  -- Blocks that exist in both snapshots but have different parent (and no content change)
  SELECT
    'moved_' || ls.block_id::text || '_' || TO_CHAR(ls.dbt_updated_at, 'YYYYMMDD_HH24MISS') AS change_id,
    ls.block_id::text AS block_id,
    'moved' AS change_type,
    es.dbt_updated_at AS previous_snapshot_time,     -- Earlier timestamp
    ls.dbt_updated_at AS current_snapshot_time,      -- Later timestamp
    es.text_content AS old_text,                     -- Include the text content
    ls.text_content AS new_text,                     -- Include the text content (same as old)
    es.parent_id::text AS old_parent,
    ls.parent_id::text AS new_parent,
    es.block_type AS old_type,                       -- Include block type for completeness
    ls.block_type AS new_type                        -- Include block type (same as old)
  FROM later_snapshot_blocks ls
  JOIN earlier_state_blocks es ON ls.block_id = es.block_id
    AND es.later_snapshot = ls.dbt_updated_at
  WHERE es.parent_id IS DISTINCT FROM ls.parent_id
    AND es.text_content IS NOT DISTINCT FROM ls.text_content  -- Only if content didn't change
),
updated_and_moved AS (
  -- Blocks that exist in both snapshots but have both content AND parent changes
  SELECT
    'updated_and_moved_' || ls.block_id::text || '_' || TO_CHAR(ls.dbt_updated_at, 'YYYYMMDD_HH24MISS') AS change_id,
    ls.block_id::text AS block_id,
    'updated_and_moved' AS change_type,
    es.dbt_updated_at AS previous_snapshot_time,     -- Earlier timestamp
    ls.dbt_updated_at AS current_snapshot_time,      -- Later timestamp
    es.text_content AS old_text,
    ls.text_content AS new_text,
    es.parent_id::text AS old_parent,
    ls.parent_id::text AS new_parent,
    es.block_type AS old_type,
    ls.block_type AS new_type
  FROM later_snapshot_blocks ls
  JOIN earlier_state_blocks es ON ls.block_id = es.block_id
    AND es.later_snapshot = ls.dbt_updated_at
  WHERE es.text_content IS DISTINCT FROM ls.text_content
    AND es.parent_id IS DISTINCT FROM ls.parent_id  -- Both content AND parent changed
),
type_changed AS (
  -- Blocks that exist in both snapshots but have different type (and no content/parent change)
  SELECT
    'type_changed_' || ls.block_id::text || '_' || TO_CHAR(ls.dbt_updated_at, 'YYYYMMDD_HH24MISS') AS change_id,
    ls.block_id::text AS block_id,
    'type_changed' AS change_type,
    es.dbt_updated_at AS previous_snapshot_time,     -- Earlier timestamp
    ls.dbt_updated_at AS current_snapshot_time,      -- Later timestamp
    es.text_content AS old_text,                     -- Include the text content
    ls.text_content AS new_text,                     -- Include the text content (same as old)
    es.parent_id::text AS old_parent,                -- Include parent info (same as new)
    ls.parent_id::text AS new_parent,                -- Include parent info (same as old)
    es.block_type AS old_type,
    ls.block_type AS new_type
  FROM later_snapshot_blocks ls
  JOIN earlier_state_blocks es ON ls.block_id = es.block_id
    AND es.later_snapshot = ls.dbt_updated_at
  WHERE es.block_type IS DISTINCT FROM ls.block_type
    AND es.text_content IS NOT DISTINCT FROM ls.text_content  -- Only if content didn't change
    AND es.parent_id IS NOT DISTINCT FROM ls.parent_id  -- Only if parent didn't change
)

SELECT * FROM added
UNION ALL
SELECT * FROM updated
UNION ALL
SELECT * FROM moved
UNION ALL
SELECT * FROM updated_and_moved
UNION ALL
SELECT * FROM type_changed 