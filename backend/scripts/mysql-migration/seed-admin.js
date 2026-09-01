#!/usr/bin/env node
/**
 * Creates or updates a system administrator in the MySQL database.
 *
 * Credentials come from the command line or the environment, never from this
 * file - a password committed to the repository is a password leaked. The
 * stored value is a bcrypt hash at the same cost the application uses, so the
 * normal sign-in path verifies it without any special casing.
 *
 * Usage:
 *   node seed-admin.js --email someone@example.com --password '...' [--name 'Full Name']
 */
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const CONFIG = {
  host: arg("host", process.env.MYSQL_HOST || "127.0.0.1"),
  port: Number(arg("port", process.env.MYSQL_PORT || 3306)),
  user: arg("user", process.env.MYSQL_USER || "root"),
  password: arg("db-password", process.env.MYSQL_PASSWORD || ""),
  database: arg("database", process.env.MYSQL_DATABASE || "educlub"),
};

async function main() {
  const email = arg("email", process.env.SEED_ADMIN_EMAIL);
  const password = arg("password", process.env.SEED_ADMIN_PASSWORD);
  const fullName = arg("name", process.env.SEED_ADMIN_NAME || "System Administrator");
  const username = arg("username", email ? email.split("@")[0] : null);

  if (!email || !password) {
    throw new Error("--email and --password are required (or SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  // Cost 10 matches src/utils/password.js; a mismatch would still verify, but
  // keeping them equal means seeded and app-created accounts are indistinguishable.
  const hash = await bcrypt.hash(password, 10);
  const db = await mysql.createConnection(CONFIG);

  await db.query(
    `INSERT INTO users (email, password, full_name, role, username, force_password_reset, is_active)
     VALUES (?, ?, ?, 'system_admin', ?, 0, 1)
     ON DUPLICATE KEY UPDATE
       password = VALUES(password),
       full_name = VALUES(full_name),
       role = 'system_admin',
       force_password_reset = 0,
       is_active = 1,
       updated_at = CURRENT_TIMESTAMP`,
    [email, hash, fullName, username],
  );

  const [rows] = await db.query(
    "SELECT id, email, full_name, role, username, is_active, force_password_reset FROM users WHERE email = ?",
    [email],
  );
  await db.end();

  const user = rows[0];
  console.log("system administrator ready");
  console.log(`  id       : ${user.id}`);
  console.log(`  email    : ${user.email}`);
  console.log(`  username : ${user.username}`);
  console.log(`  role     : ${user.role}`);
  console.log(`  active   : ${user.is_active ? "yes" : "no"}`);
  console.log(`  must change password at sign-in: ${user.force_password_reset ? "yes" : "no"}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
