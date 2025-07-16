# Block Registry + Deletion Detection Setup Instructions

This document contains the complete setup instructions for implementing deletion detection using the Block Registry approach.

## Overview

The Block Registry approach tracks block lifecycle separately from dbt snapshots to detect deletions that the Notion Airbyte connector cannot detect directly.

## Database Schema Setup

### Step 1: Create Database Tables

Run these SQL statements in your Supabase/PostgreSQL database:

```sql
-- Create block_registry table
CREATE TABLE IF NOT EXISTS public.block_registry (
  block_id UUID PRIMARY KEY,
  first_seen_at TIMESTAMP NOT NULL,
  last_seen_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_known_text TEXT,
  last_known_parent_id UUID,
  last_known_block_type TEXT,
  consecutive_misses INT DEFAULT 0
);

-- Create deletion_events table
CREATE TABLE IF NOT EXISTS public.deletion_events (
  deletion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES block_registry(block_id),
  detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL,
  missing_for_hours INT NOT NULL,
  last_known_text TEXT,
  last_known_parent_id UUID,
  last_known_block_type TEXT,
  confidence_level TEXT NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_block_registry_last_seen ON public.block_registry(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_block_registry_is_active ON public.block_registry(is_active);
CREATE INDEX IF NOT EXISTS idx_deletion_events_detected_at ON public.deletion_events(detected_at);
CREATE INDEX IF NOT EXISTS idx_deletion_events_confidence ON public.deletion_events(confidence_level);
```

### Step 2: Initial Population of Block Registry

Run this SQL to populate the registry with all current blocks:

```sql
-- Initial population of block_registry
INSERT INTO public.block_registry (
  block_id,
  first_seen_at,
  last_seen_at,
  is_active,
  last_known_text,
  last_known_parent_id,
  last_known_block_type,
  consecutive_misses
)
SELECT
  id::uuid AS block_id,
  CURRENT_TIMESTAMP AS first_seen_at,
  CURRENT_TIMESTAMP AS last_seen_at,
  TRUE AS is_active,
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
  ) AS last_known_text,
  CASE 
    WHEN parent ->> 'type' = 'page_id' THEN (parent ->> 'page_id')::uuid
    WHEN parent ->> 'type' = 'block_id' THEN (parent ->> 'block_id')::uuid
    WHEN parent ->> 'type' = 'database_id' THEN (parent ->> 'database_id')::uuid
    WHEN parent ->> 'type' = 'workspace_id' THEN (parent ->> 'workspace_id')::uuid
    ELSE NULL
  END AS last_known_parent_id,
  TRIM(BOTH '"' FROM type::text) AS last_known_block_type,
  0 AS consecutive_misses
FROM public.blocks
ON CONFLICT (block_id) DO NOTHING;
```

## dbt Models and Configuration

The following dbt models and configuration will be created automatically:

1. `models/marts/block_registry_update.sql` - Updates the block registry
2. `models/marts/deletion_events_generator.sql` - Generates deletion events
3. `models/marts/complete_diff_history.sql` - Combines standard diffs with deletions
4. Updated `dbt_project.yml` with new model configurations

## Integration with Existing Workflow

The deletion detection models are designed to run automatically as part of your regular `dbt run` workflow. After each Airbyte sync, simply run:

```bash
dbt run
```

This will execute all models including the new deletion detection models:
1. `block_registry_update` - Updates the registry with current block states
2. `deletion_events_generator` - Generates deletion events for missing blocks
3. `complete_diff_history` - Combines standard diffs with deletion events

No separate scheduling is needed since the models run with your existing dbt workflow.

## Configuration Parameters

Tunable parameters in `dbt_project.yml`:

- `deletion_confirmation_threshold`: Number of consecutive misses before marking inactive (default: 3)
- `medium_confidence_threshold`: Threshold for 'likely' deletion confidence (default: 3)  
- `high_confidence_threshold`: Threshold for 'confirmed' deletion confidence (default: 5)

## Monitoring

- Check `deletion_events` table regularly for new deletions
- Monitor `block_registry` for blocks with high `consecutive_misses`
- Validate deletion accuracy by spot-checking against Notion

## Maintenance

- Archive old registry entries (>6 months) periodically
- Monitor deletion rates for anomalies
- Adjust confidence thresholds based on accuracy observations
