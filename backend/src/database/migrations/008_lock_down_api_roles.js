module.exports = {
  async up(client) {
    // Two tables were created without row level security, so the Supabase API
    // roles could read them directly: user_sessions exposes refresh token
    // hashes, user ids and IP addresses, and schema_migrations exposes the
    // deployment history. Neither is ever reached through PostgREST.
    //
    // No policies are attached on purpose. RLS with zero policies denies every
    // row to any role that does not bypass RLS, which is exactly right here:
    // the application connects as a BYPASSRLS role and does its own
    // authorisation, and nothing else should read these tables at all.
    await client.query(`
      ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
    `);

    // RLS alone is not enough. The anon and authenticated roles hold full DML
    // on every table in public, and TRUNCATE is a table privilege that RLS does
    // not govern - so those roles could empty even the tables that do have
    // policies. This application never uses the Supabase REST API (no
    // supabase-js dependency, no anon key anywhere in the codebase); it
    // connects straight to Postgres. Those roles therefore need no privileges.
    //
    // service_role is left alone: Supabase's own tooling uses it, and it is not
    // reachable with the public key.
    await client.query(`
      DO $$
      DECLARE
        target text;
      BEGIN
        FOREACH target IN ARRAY ARRAY['anon', 'authenticated'] LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target) THEN
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', target);
            EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', target);
            EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', target);

            -- Without this, every table created later is granted to them again
            -- by Supabase's default privileges and the hole silently reopens.
            EXECUTE format(
              'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', target);
            EXECUTE format(
              'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', target);
            EXECUTE format(
              'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', target);

            -- Default privileges are recorded per granting role, so repeat them
            -- for postgres, which is what creates objects during migrations.
            EXECUTE format(
              'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM %I', target);
            EXECUTE format(
              'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', target);
            EXECUTE format(
              'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', target);
          END IF;
        END LOOP;
      END
      $$;
    `);
  },
};
