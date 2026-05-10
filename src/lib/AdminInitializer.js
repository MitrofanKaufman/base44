import { base44 } from '@/api/base44Client';

export function isUser1Account(user) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase();
  const localPart = email.split('@')[0];
  const fullName = (user.full_name || '').toLowerCase();

  return (
    localPart === 'user1' ||
    /^user\s*1$/.test(fullName) ||
    /^пользователь\s*1$/.test(fullName)
  );
}

// Инициализирует первого пользователя как администратора
export async function ensureFirstUserIsAdmin() {
  try {
    // Попытка обновить текущего пользователя на админа
    // если операция не будет заблокирована - первый пользователь получит доступ
    await base44.auth.updateMe({ role: 'admin' });
    return true;
  } catch (error) {
    // Если обновление не получилось - это нормально для non-first пользователя
    return false;
  }
}

// Выдаёт права администратора пользователю "user1"
export async function ensureUser1IsAdmin(currentUser) {
  try {
    let changed = false;

    if (isUser1Account(currentUser)) {
      await base44.auth.updateMe({ role: 'admin' });
      changed = true;
    }

    // Пытаемся обновить и запись в сущности User, если у текущего аккаунта есть права
    try {
      const users = await base44.entities.User.list('-created_date', 500);
      const user1 = users.find(isUser1Account);
      if (user1 && user1.role !== 'admin') {
        await base44.entities.User.update(user1.id, { role: 'admin' });
        changed = true;
      }
    } catch (_) {
      // Для большинства пользователей update чужих записей может быть запрещен — это нормально.
    }

    return changed;
  } catch (error) {
    return false;
  }
}
