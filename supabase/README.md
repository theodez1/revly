# Supabase Database

This folder contains all database-related files for StravaCar.

## Structure

```
supabase/
├── schema.sql              # Main database schema
├── migrations/             # Database migrations
├── policies/               # RLS policies
├── triggers/               # Database triggers
└── archive/                # Old/deprecated SQL files
```

## Quick Start

1. **Initialize database:**
   ```bash
   psql -U postgres -d strava car -f schema.sql
   ```

2. **Run migrations:**
   ```bash
   # Run migrations in order
   psql -U postgres -d stravacar -f migrations/YYYYMMDD_*.sql
   ```

## Key Files

- `schema.sql` - Core database structure (users, rides, groups, etc.)
- `rls_policies.sql` - Row Level Security policies
- `storage_setup.sql` - Storage buckets configuration
- `RIDE_COMMENTS_TABLE.sql` - Ride comments feature

## Important Notes

- Always backup before running migrations
- Test RLS policies in development first
- Use migrations folder for schema changes
- Archive old files instead of deleting
