# dbt Snapshots

This directory contains dbt snapshots for tracking historical changes in your data.

## What are Snapshots?

Snapshots are dbt's way of implementing **Type 2 Slowly Changing Dimensions (SCD)**. They track changes over time by:

- Creating new records when data changes
- Marking old records as inactive
- Maintaining a complete history of all changes

## Available Snapshots

### snapshot_blocks
Tracks changes to Notion blocks over time based on `last_edited_time`.

**Columns:**
- `dbt_scd_id` - Unique identifier for each snapshot record
- `block_id` - The block identifier
- `parent_block_id` - Parent block reference
- `block_type` - Type of block (cleaned)
- `text_content` - Extracted text content
- `created_time` - When block was created
- `last_edited_time` - When block was last edited
- `dbt_updated_at` - When this snapshot was created
- `dbt_valid_from` - Start date for this version
- `dbt_valid_to` - End date for this version (NULL if current)

## How to Use

### First Run (Initial Snapshot)
```bash
python run_dbt.py snapshot
```

This creates the initial snapshot table with all current data.

### Subsequent Runs (Track Changes)
```bash
python run_dbt.py snapshot
```

This will:
- Compare current data with the last snapshot
- Insert new records for changed blocks
- Mark old versions as inactive (set `dbt_valid_to`)

### Query Current Data
```sql
SELECT * FROM snapshot_blocks 
WHERE dbt_valid_to IS NULL;
```

### Query Historical Data
```sql
SELECT * FROM snapshot_blocks 
WHERE block_id = 'your-block-id'
ORDER BY dbt_valid_from;
```

## Configuration

The snapshot is configured to:
- Use `block_id` as the unique key
- Track changes based on `last_edited_time`
- Store data in the `public` schema 