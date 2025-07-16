{{
  config(
    materialized='incremental',
    unique_key='deletion_id',
    post_hook="INSERT INTO public.deletion_events (deletion_id, block_id, detected_at, last_seen_at, missing_for_hours, last_known_text, last_known_parent_id, last_known_block_type, confidence_level)
               SELECT deletion_id, block_id, detected_at, last_seen_at, missing_for_hours, last_known_text, last_known_parent_id, last_known_block_type, confidence_level
               FROM {{ this }}
               ON CONFLICT (deletion_id) DO NOTHING"
  )
}}

-- Identify blocks that have crossed the deletion threshold
WITH deletion_candidates AS (
  SELECT
    block_id,
    last_seen_at,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_seen_at))/3600 AS hours_since_last_seen,
    consecutive_misses,
    last_known_text,
    last_known_parent_id,
    last_known_block_type
  FROM public.block_registry
  WHERE
    is_active = FALSE AND  -- Already marked inactive
    consecutive_misses >= {{ var('deletion_confirmation_threshold', 3) }}
    {% if is_incremental() %}
    -- Only process blocks not already recorded as deleted
    AND block_id NOT IN (
      SELECT block_id
      FROM public.deletion_events
    )
    {% endif %}
),

-- Classify deletions by confidence level
classified_deletions AS (
  SELECT
    block_id,
    last_seen_at,
    hours_since_last_seen,
    last_known_text,
    last_known_parent_id,
    last_known_block_type,
    consecutive_misses,
    -- Calculate estimated deletion time (when block first went missing)
    -- Work backwards: if we have 3 consecutive misses, the block was likely deleted
    -- shortly after last_seen_at (assuming regular sync intervals)
    last_seen_at + INTERVAL '30 minutes' AS estimated_deleted_at,
    CASE
      WHEN consecutive_misses >= {{ var('high_confidence_threshold', 5) }} THEN 'confirmed'
      WHEN consecutive_misses >= {{ var('medium_confidence_threshold', 3) }} THEN 'likely'
      ELSE 'possible'
    END AS confidence_level
  FROM deletion_candidates
)

-- Generate deletion events
SELECT
  gen_random_uuid() AS deletion_id,
  block_id,
  estimated_deleted_at AS detected_at,  -- Use estimated deletion time instead of now
  last_seen_at,
  FLOOR(hours_since_last_seen)::INT AS missing_for_hours,
  last_known_text,
  last_known_parent_id,
  last_known_block_type,
  confidence_level
FROM classified_deletions
