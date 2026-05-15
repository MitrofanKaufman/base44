import pg from 'pg';

const { Pool } = pg;

/**
 * Пул соединений с PostgreSQL (singleton)
 * @type {Pool|null}
 */
let pool;

/**
 * Возвращает или создает пул соединений с PostgreSQL
 * @returns {Pool} Пул соединений с базой данных
 */
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
