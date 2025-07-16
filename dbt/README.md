# dbt Setup for Supabase

This dbt project is configured to work with your Supabase PostgreSQL database.

## Required Environment Variables

Create a `.env` file in the dbt directory with the following variables:

```bash
# Database password (from your Supabase connection string)
DBT_PASSWORD=EqaMXiucxQb9Yvv5

# Optional: Additional Supabase environment variables
SUPABASE_URL=https://ckitkhrumakndgqnwdtg.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Connection Details

Based on your existing backend configuration, your Supabase connection details are:

- **Host**: aws-0-eu-central-1.pooler.supabase.com
- **Port**: 5432
- **Database**: postgres
- **User**: postgres.ckitkhrumakndgqnwdtg
- **Password**: EqaMXiucxQb9Yvv5 (set as DBT_PASSWORD environment variable)
- **Schema**: public
- **SSL Mode**: require

## Setup Instructions

1. Install dbt-core and dbt-postgres:
   ```bash
   pip install dbt-core dbt-postgres
   ```

2. Create your `.env` file with the credentials above

3. Initialize the project:
   ```bash
   cd dbt
   dbt deps
   ```

4. Test the connection:
   ```bash
   dbt debug
   ```

5. Run your first dbt command:
   ```bash
   dbt run
   ```

## Project Structure

- `models/` - Your dbt models (SQL transformations)
- `tests/` - Custom tests
- `macros/` - Reusable SQL macros
- `seeds/` - Static data files
- `snapshots/` - Type 2 SCD tracking
- `analyses/` - One-off analyses

## Getting Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to Settings > Database
3. Copy the connection string or individual credentials
4. For API keys, go to Settings > API 