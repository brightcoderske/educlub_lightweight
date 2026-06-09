/**
 * Seed Admin User Script
 * Creates a default system admin user
 */

const path = require('path');
const bcrypt = require('../backend/node_modules/bcrypt');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { query, pool } = require('../backend/src/config/db');
const env = require('../backend/src/config/env');

async function seedAdmin() {
  try {
    console.log('Seeding admin user...');
    
    const email = env.systemAdminEmail;
    const password = env.defaultAdminPassword;
    const fullName = 'System Admin';

    if (!email || !password) {
      throw new Error('SYSTEM_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD must be set in environment variables');
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await query(
      `INSERT INTO users (email, password, full_name, role, force_password_reset, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE
       SET password = EXCLUDED.password,
           full_name = EXCLUDED.full_name,
           role = 'system_admin',
           force_password_reset = true,
           is_active = true,
           updated_at = CURRENT_TIMESTAMP`,
      [email, hashedPassword, fullName, 'system_admin', true, true]
    );
    
    console.log('Admin user is ready');
    console.log(`Email: ${email}`);
    console.log('Password change required on first login');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed admin user:', error);
    await pool.end();
    process.exit(1);
  }
}

seedAdmin();
