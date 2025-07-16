{{
  config(
    materialized='table',
    post_hook="INSERT INTO public.block_registry (block_id, first_seen_at, last_seen_at, is_active, last_known_text, last_known_parent_id, last_known_block_type, consecutive_misses) 
               SELECT block_id, first_seen_at, last_seen_at, is_active, last_known_text, last_known_parent_id, last_known_block_type, consecutive_misses 
               FROM {{ this }} 
               ON CONFLICT (block_id) DO UPDATE SET 
                 last_seen_at = EXCLUDED.last_seen_at,
                 is_active = EXCLUDED.is_active,
                 last_known_text = EXCLUDED.last_known_text,
                 last_known_parent_id = EXCLUDED.last_known_parent_id,
                 last_known_block_type = EXCLUDED.last_known_block_type,
                 consecutive_misses = EXCLUDED.consecutive_misses"
  )
}}

-- Get current blocks from source
WITH current_blocks AS (
  SELECT
    id::uuid AS block_id,
    CURRENT_TIMESTAMP AS observation_time,
    CASE 
      WHEN parent ->> 'type' = 'page_id' THEN (parent ->> 'page_id')::uuid
      WHEN parent ->> 'type' = 'block_id' THEN (parent ->> 'block_id')::uuid
      WHEN parent ->> 'type' = 'database_id' THEN (parent ->> 'database_id')::uuid
      WHEN parent ->> 'type' = 'workspace_id' THEN (parent ->> 'workspace_id')::uuid
      ELSE NULL
    END AS parent_id,
    TRIM(BOTH '"' FROM type::text) AS block_type,
    COALESCE(
      (SELECT string_agg(plain_text, '' ORDER BY rn)
       FROM (SELECT rt->>'plain_text' as plain_text, row_number() over () as rn
             FROM jsonb_array_elements(paragraph->'rich_text') AS rt) t),
      (SELECT string_agg(plain_text, '' ORDER BY rn)
       FROM (SELECT rt->>'plain_text' as plain_text, row_number() over () as rn
             FROM jsonb_array_elements(heading_1->'rich_text') AS rt) t),
      (SELECT string_agg(plain_text, '' ORDER BY rn)
       FROM (SELECT rt->>'plain_text' as plain_text, row_number() over () as rn
             FROM jsonb_array_elements(heading_2->'rich_text') AS rt) t),
      (SELECT string_agg(plain_text, '' ORDER BY rn)
       FROM (SELECT rt->>'plain_text' as plain_text, row_number() over () as rn
             FROM jsonb_array_elements(toggle->'rich_text') AS rt) t),
      (SELECT string_agg(plain_text, '' ORDER BY rn)
       FROM (SELECT rt->>'plain_text' as plain_text, row_number() over () as rn
             FROM jsonb_array_elements(to_do->'rich_text') AS rt) t),
      (SELECT string_agg(plain_text, '' ORDER BY rn)
       FROM (SELECT rt->>'plain_text' as plain_text, row_number() over () as rn
             FROM jsonb_array_elements(bulleted_list_item->'rich_text') AS rt) t),
      (SELECT string_agg(plain_text, '' ORDER BY rn)
       FROM (SELECT rt->>'plain_text' as plain_text, row_number() over () as rn
             FROM jsonb_array_elements(numbered_list_item->'rich_text') AS rt) t),
      (SELECT string_agg(plain_text, '' ORDER BY rn)
       FROM (SELECT rt->>'plain_text' as plain_text, row_number() over () as rn
             FROM jsonb_array_elements(quote->'rich_text') AS rt) t),
      code ->> 'text'
    ) AS text_content
  FROM {{ source('raw', 'blocks') }}
),

-- Get existing registry entries
existing_registry AS (
  SELECT *
  FROM public.block_registry
),

-- Identify new blocks to add to registry
new_blocks AS (
  SELECT
    cb.block_id,
    CURRENT_TIMESTAMP AS first_seen_at,
    CURRENT_TIMESTAMP AS last_seen_at,
    TRUE AS is_active,
    cb.text_content AS last_known_text,
    cb.parent_id AS last_known_parent_id,
    cb.block_type AS last_known_block_type,
    0 AS consecutive_misses
  FROM current_blocks cb
  LEFT JOIN existing_registry br ON cb.block_id = br.block_id
  WHERE br.block_id IS NULL
),

-- Identify existing blocks to update (blocks that are currently present)
existing_blocks AS (
  SELECT
    br.block_id,
    br.first_seen_at,
    CURRENT_TIMESTAMP AS last_seen_at,
    TRUE AS is_active,
    cb.text_content AS last_known_text,
    cb.parent_id AS last_known_parent_id,
    cb.block_type AS last_known_block_type,
    0 AS consecutive_misses  -- Reset misses when seen
  FROM existing_registry br
  JOIN current_blocks cb ON br.block_id = cb.block_id
),

-- Identify potentially deleted blocks (not seen in current run)
missing_blocks AS (
  SELECT
    br.block_id,
    br.first_seen_at,
    br.last_seen_at,  -- Keep last seen timestamp
    CASE
      WHEN (br.consecutive_misses + 1) >= {{ var('deletion_confirmation_threshold', 3) }} THEN FALSE
      ELSE TRUE
    END AS is_active,
    br.last_known_text,
    br.last_known_parent_id,
    br.last_known_block_type,
    br.consecutive_misses + 1 AS consecutive_misses
  FROM existing_registry br
  LEFT JOIN current_blocks cb ON br.block_id = cb.block_id
  WHERE cb.block_id IS NULL
)

-- Combine all updates
SELECT * FROM new_blocks
UNION ALL
SELECT * FROM existing_blocks
UNION ALL
SELECT * FROM missing_blocks
