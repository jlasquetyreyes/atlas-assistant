{{
  config(
    materialized='table'
  )
}}

SELECT 
  block_id,
  parent_id,
  parent_type,
  block_type,
  text_content,
  created_time,
  last_edited_time,
  page_id,
  -- Calculate text metrics
  LENGTH(COALESCE(text_content, '')) as character_length,
  ARRAY_LENGTH(STRING_TO_ARRAY(COALESCE(text_content, ''), ' '), 1) as word_length,
  -- Create vector database ID
  'vector_' || block_id::text as vector_id,
  -- Create metadata JSON
  JSONB_BUILD_OBJECT(
    'page_id', page_id,
    'parent_id', parent_id,
    'parent_type', parent_type,
    'block_type', block_type,
    'created_time', created_time,
    'last_edited_time', last_edited_time,
    'character_length', LENGTH(COALESCE(text_content, '')),
    'word_length', ARRAY_LENGTH(STRING_TO_ARRAY(COALESCE(text_content, ''), ' '), 1)
  ) as metadata
FROM {{ ref('stg_blocks') }}
WHERE 
  -- Only include blocks with meaningful content
  LENGTH(TRIM(COALESCE(text_content, ''))) > 0
  -- Filter out very short chunks
  AND LENGTH(COALESCE(text_content, '')) >= 50
  -- Filter out extremely long chunks (avoid 20k word chunks!)
  AND LENGTH(COALESCE(text_content, '')) <= 10000  -- ~2000-3000 words max 