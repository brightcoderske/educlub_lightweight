// NOT RUN BY CI, AND NOT RUNNABLE ON THE PRODUCTION STACK.
//
// This suite predates the move off Supabase PostgreSQL. It asserts that
// PostgreSQL row level security denies cross-school access, using CREATE ROLE,
// NOBYPASSRLS, GRANT ... ON SCHEMA public and DROP OWNED BY - none of which
// exist in MySQL, which is what production and CI now run.
//
// The tenant boundary it was written to protect did not disappear with RLS: the
// application connected as a BYPASSRLS role even on PostgreSQL, so the checks
// that actually held were always the ones in the request path. Those are
// covered by test/crossSchoolIsolation.test.js, which runs on every push.
//
// Kept for reference until it is either ported or removed deliberately.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { pool } = require("../../src/config/db");
const sessions = require("../../src/services/session.service");

const suffix = crypto.randomBytes(5).toString("hex");
const rlsRole = `educlub_rls_${suffix}`;

test.before(async () => {
  const client = await pool.connect();
  try {
    await client.query(`CREATE ROLE ${rlsRole} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${rlsRole}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${rlsRole}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${rlsRole}`);
    await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${rlsRole}`);
  } finally {
    client.release();
  }
});

test.after(async () => {
  const client = await pool.connect();
  try {
    await client.query(`DROP OWNED BY ${rlsRole}`);
    await client.query(`DROP ROLE ${rlsRole}`);
  } finally {
    client.release();
    await pool.end();
  }
});

test("RLS denies cross-school reads, updates, and inserts", async () => {
  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    const schools = await client.query(
      `INSERT INTO schools (name, code, is_active) VALUES
       ($1, $2, true), ($3, $4, true) RETURNING id`,
      [`School A ${suffix}`, `A-${suffix}`, `School B ${suffix}`, `B-${suffix}`],
    );
    const [schoolA, schoolB] = schools.rows;
    const users = await client.query(
      `INSERT INTO users (email, password, full_name, role, school_id, username, is_active)
       VALUES ($1, 'hash', 'Admin A', 'school_admin', $3, $2, true),
              ($4, 'hash', 'Learner B', 'learner', $6, $5, true)
       RETURNING id, school_id`,
      [`admin-a-${suffix}@example.test`, `admina${suffix}`, schoolA.id,
        `learner-b-${suffix}@example.test`, `learnerb${suffix}`, schoolB.id],
    );
    const admin = users.rows[0];
    const learnerUser = users.rows[1];
    const learner = await client.query(
      `INSERT INTO learners (user_id, school_id, full_name, email)
       VALUES ($1, $2, 'Learner B', $3) RETURNING id`,
      [learnerUser.id, schoolB.id, `learner-b-${suffix}@example.test`],
    );

    await client.query(`SET LOCAL ROLE ${rlsRole}`);
    await client.query("SELECT set_config('educlub.user_id', $1, true)", [String(admin.id)]);
    await client.query("SELECT set_config('educlub.role', 'school_admin', true)");
    await client.query("SELECT set_config('educlub.school_id', $1, true)", [String(schoolA.id)]);

    assert.equal((await client.query("SELECT id FROM learners WHERE id = $1", [learner.rows[0].id])).rowCount, 0);
    assert.equal((await client.query("UPDATE learners SET grade = '9' WHERE id = $1", [learner.rows[0].id])).rowCount, 0);
    await assert.rejects(
      () => client.query(
        "INSERT INTO learners (user_id, school_id, full_name, email) VALUES ($1, $2, 'Cross tenant', $3)",
        [admin.id, schoolB.id, `cross-${suffix}@example.test`],
      ),
      (error) => error.code === "42501",
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("refresh rotation stores only hashes and revokes a family on reuse", async () => {
  const user = await pool.query(
    `INSERT INTO users (email, password, full_name, role, username, is_active)
     VALUES ($1, 'hash', 'Session User', 'system_admin', $2, true) RETURNING id`,
    [`session-${suffix}@example.test`, `session${suffix}`],
  );
  try {
    const original = await sessions.createSession(user.rows[0].id, { userAgent: "integration-test" });
    const stored = await pool.query("SELECT refresh_token_hash FROM user_sessions WHERE id = $1", [original.id]);
    assert.notEqual(stored.rows[0].refresh_token_hash, original.token);
    assert.equal(stored.rows[0].refresh_token_hash, sessions.hashToken(original.token));

    const replacement = await sessions.rotateSession(original.token, { userAgent: "integration-test-rotated" });
    assert.notEqual(replacement.token, original.token);
    await assert.rejects(() => sessions.rotateSession(original.token), /reuse detected/i);

    const family = await pool.query(
      `SELECT COUNT(*)::integer AS total,
              COUNT(*) FILTER (WHERE revoked_at IS NOT NULL)::integer AS revoked
       FROM user_sessions WHERE user_id = $1`,
      [user.rows[0].id],
    );
    assert.deepEqual(family.rows[0], { total: 2, revoked: 2 });
  } finally {
    await pool.query("DELETE FROM users WHERE id = $1", [user.rows[0].id]);
  }
});
