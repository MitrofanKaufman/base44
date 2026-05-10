import bcrypt from 'bcryptjs';
import { getPool } from '../src/db.js';

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');
const fullName = String(process.env.ADMIN_FULL_NAME || 'Administrator').trim();

if (!email || !password) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  process.exit(1);
}

if (password.length < 8) {
  console.error('ADMIN_PASSWORD must be at least 8 characters');
  process.exit(1);
}

const pool = getPool();

try {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
      created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by TEXT
    )
  `);
  await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash TEXT');

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO app_users (email, full_name, role, password_hash, created_by)
     VALUES ($1, $2, 'admin', $3, $1)
     ON CONFLICT (email) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           role = 'admin',
           password_hash = EXCLUDED.password_hash,
           updated_date = now()
     RETURNING id, email, full_name, role, created_date, updated_date`,
    [email, fullName, passwordHash]
  );

  const user = result.rows[0];
  console.log(`Admin profile ready: ${user.email} (${user.role})`);
} catch (error) {
  console.error(`Failed to create admin profile: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
