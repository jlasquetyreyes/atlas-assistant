{{
  config(
    materialized='view'
  )
}}

SELECT 
  id::uuid as block_id,
  CASE 
    WHEN parent ->> 'type' = 'page_id' THEN (parent ->> 'page_id')::uuid
    WHEN parent ->> 'type' = 'block_id' THEN (parent ->> 'block_id')::uuid
    WHEN parent ->> 'type' = 'database_id' THEN (parent ->> 'database_id')::uuid
    WHEN parent ->> 'type' = 'workspace_id' THEN (parent ->> 'workspace_id')::uuid
    ELSE NULL
  END AS parent_id,
  parent ->> 'type' AS parent_type,
  TRIM(BOTH '"' FROM type::text) AS block_type,
  -- Use the same text concatenation logic as snapshot_blocks.sql
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
  ) AS text_content,
  created_time,
  last_edited_time,
  -- Extract page_id from parent if it's a page
  CASE 
    WHEN parent ->> 'type' = 'page_id' THEN (parent ->> 'page_id')::uuid
    ELSE NULL
  END as page_id
FROM {{ source('raw', 'blocks') }} 