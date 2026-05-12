import bcrypt from 'bcryptjs';
import { clearAuthCookie, requireAuth, requireRole, setAuthCookie, signAccessToken } from './auth.js';

const roleOverrideAllowed = (process.env.ALLOW_ROLE_OVERRIDE || 'false') === 'true';

const withLimiter = (limiter) => (limiter ? [limiter] : []);

export function registerAuthRoutes(app, pool, options = {}) {
  app.post('/auth/register', ...withLimiter(options.authRateLimiter), async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const fullName = String(req.body?.full_name || '').trim();
    const { password, role } = req.body || {};

    if (!email || !fullName || !password) {
      return res.status(400).json({ error: 'email, full_name and password are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 chars' });
    }

    const exists = await pool.query('SELECT id FROM app_users WHERE lower(email) = lower($1)', [email]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'user already exists' });
    }

    const count = await pool.query('SELECT count(*)::int AS count FROM app_users');
    const firstUser = count.rows[0]?.count === 0;
    const userRole = firstUser ? 'admin' : (roleOverrideAllowed && role ? role : 'user');

    if (!['admin', 'user'].includes(userRole)) {
      return res.status(400).json({ error: 'invalid role' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const insert = await pool.query(
      `INSERT INTO app_users (email, full_name, role, password_hash, created_by)
       VALUES ($1, $2, $3, $4, $1)
       RETURNING id, email, full_name, role, created_date, updated_date, created_by`,
      [email, fullName, userRole, password_hash]
    );

    const user = insert.rows[0];
    const token = signAccessToken(user);
    setAuthCookie(res, token);
    return res.status(201).json({ token, user });
  });

  app.post('/auth/login', ...withLimiter(options.authRateLimiter), async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const { password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const result = await pool.query(
      'SELECT id, email, full_name, role, password_hash, created_date, updated_date, created_by FROM app_users WHERE lower(email) = lower($1)',
      [email]
    );
    const user = result.rows[0];
    if (!user?.password_hash) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      created_date: user.created_date,
      updated_date: user.updated_date,
      created_by: user.created_by
    };

    const token = signAccessToken(safeUser);
    setAuthCookie(res, token);
    return res.json({ token, user: safeUser });
  });

  app.post('/auth/logout', (_req, res) => {
    clearAuthCookie(res);
    return res.status(204).send();
  });

  app.get('/auth/me', requireAuth, async (req, res) => {
    const result = await pool.query(
      'SELECT id, email, full_name, role, created_date, updated_date, created_by FROM app_users WHERE id = $1',
      [req.auth.sub]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'user not found' });
    return res.json(result.rows[0]);
  });

  app.put('/auth/me', requireAuth, async (req, res) => {
    const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : undefined;

    if (!fullName) {
      return res.status(400).json({ error: 'full_name is required' });
    }

    const result = await pool.query(
      `UPDATE app_users
       SET full_name = $1, updated_date = now()
       WHERE id = $2
       RETURNING id, email, full_name, role, created_date, updated_date, created_by`,
      [fullName, req.auth.sub]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'user not found' });
    return res.json(result.rows[0]);
  });

  app.get('/auth/admin-only', requireAuth, requireRole('admin'), (_req, res) => {
    return res.json({ ok: true });
  });
}
