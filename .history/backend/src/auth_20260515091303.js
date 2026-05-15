import jwt from 'jsonwebtoken';

/**
 * Локальный секрет для разработки
 * @constant {string}
 */
const LOCAL_DEV_JWT_SECRET = 'base44-local-development-secret';

/**
 * Набор небезопасных секретов для продакшена
 * @constant {Set<string>}
 */
const UNSAFE_PRODUCTION_SECRETS = new Set([
  LOCAL_DEV_JWT_SECRET,
  'base44',
  'base44-secret',
]);

/**
 * Разрешает секрет для JWT токена из переменных окружения
 * @returns {string} Секрет для подписи JWT токенов
 * @throws {Error} Если в продакшене не установлен безопасный секрет
 */
function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET || LOCAL_DEV_JWT_SECRET;

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || UNSAFE_PRODUCTION_SECRETS.has(secret)) {
      throw new Error('JWT_SECRET must be set to a strong unique value in production');
    }
  }

  return secret;
}

/**
 * Секрет для подписи JWT токенов
 * @constant {string}
 */
const JWT_SECRET = resolveJwtSecret();

/**
 * Время жизни JWT токена
 * @constant {string}
 */
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Имя cookie для хранения токена авторизации
 * @constant {string}
 */
export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'base44_access_token';

/**
 * Возвращает опции для cookie авторизации
 * @returns {Object} Объект с опциями cookie
 * @returns {boolean} returns.httpOnly - Cookie доступна только через HTTP
 * @returns {boolean} returns.secure - Cookie передается только по HTTPS в продакшене
 * @returns {string} returns.sameSite - Политика SameSite для защиты от CSRF
 * @returns {number} returns.maxAge - Время жизни cookie в миллисекундах (7 дней)
 * @returns {string} returns.path - Путь, для которого действительна cookie
 */
function cookieOptions() {
  const production = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  };
}

/**
 * Подписывает JWT токен доступа для пользователя
 * @param {Object} user - Объект пользователя
 * @param {string} user.id - ID пользователя
 * @param {string} user.email - Email пользователя
 * @param {string} user.role - Роль пользователя
 * @returns {string} Подписанный JWT токен
 */
export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Устанавливает cookie авторизации в ответе
 * @param {Object} res - Объект ответа Express
 * @param {string} token - JWT токен для установки в cookie
 */
export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
}

/**
 * Очищает cookie авторизации
 * @param {Object} res - Объект ответа Express
 */
export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
}

/**
 * Извлекает JWT токен из запроса
 * @param {Object} req - Объект запроса Express
 * @returns {string|null} JWT токен или null, если токен не найден
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }
  if (req.cookies?.[AUTH_COOKIE_NAME]) {
    return req.cookies[AUTH_COOKIE_NAME];
  }
  return null;
}

/**
 * Middleware для проверки авторизации
 * @param {Object} req - Объект запроса Express
 * @param {Object} res - Объект ответа Express
 * @param {Function} next - Функция для передачи управления следующему middleware
 * @returns {Object|void} Ответ с ошибкой 401 или передача управления
 */
export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Создает middleware для проверки роли пользователя
 * @param {...string} roles - Разрешенные роли
 * @returns {Function} Middleware функция для проверки роли
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth?.role || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}
