import pg from 'pg';

const { Pool } = pg;

let pool;

export function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL || [
    `postgresql://${process.env.POSTGRES_USER || 'base44'}`,
    `:${process.env.POSTGRES_PASSWORD || 'base44'}`,
    `@${process.env.POSTGRES_HOST || 'postgres'}:${process.env.POSTGRES_PORT || '5432'}`,
    `/${process.env.POSTGRES_DB || 'base44'}`
  ].join('');

  pool = new Pool({ connectionString });
  return pool;
}
