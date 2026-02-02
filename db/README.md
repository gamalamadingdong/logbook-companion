# Database Schema Snapshots

This directory contains timestamped snapshots of the Supabase database schema.

## Important Notes

- **These are snapshots, not live schemas.** The actual production schema may have evolved since these files were created.
- **Timestamp format**: `db_schema_YYYY-MM-DD.sql` indicates the date the snapshot was taken.
- **Use case**: These files are provided for reference and to help contributors understand the data model.

## Latest Snapshot

- `db_schema_2026-01-30.sql` - Schema as of January 30, 2026

## Running Locally

To set up a local Supabase instance:
1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the latest schema snapshot in the SQL Editor
3. Update your `.env` file with your project credentials

Note: The schema may have changed since this snapshot. Check the migration files in `scripts/` for incremental updates.
