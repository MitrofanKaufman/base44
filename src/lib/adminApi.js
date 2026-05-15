import { apiRequest } from '@/api/base44Client';

/**
 * Получает метрики администратора
 * @returns {Promise<Object>} Метрики системы
 */
export function getAdminMetrics() {
  return apiRequest('/admin/metrics');
}

/**
 * Получает OpenAPI спецификацию
 * @returns {Promise<Object>} OpenAPI спецификация
 */
export function getOpenApiSpec() {
  return apiRequest('/openapi.json');
}

/**
 * Создает сессию активности пользователя
 * @param {Object} payload - Данные сессии
 * @returns {Promise<Object>} Созданная сессия
 */
export function createActivitySession(payload = {}) {
  return apiRequest('/activity/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Отправляет heartbeat сигнал активности
 * @param {Object} payload - Данные активности
 * @returns {Promise<Object>} Результат отправки
 */
export function sendActivityHeartbeat(payload) {
  return apiRequest('/activity/heartbeat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Получает список сообщений пользователя
 * @param {number} limit - Лимит сообщений
 * @returns {Promise<Array>} Список сообщений
 */
export function listUserMessages(limit = 50) {
  return apiRequest(`/messages?limit=${encodeURIComponent(limit)}`);
}

/**
 * Помечает сообщение как прочитанное
 * @param {string} messageId - ID сообщения
 * @returns {Promise<Object>} Результат операции
 */
export function markUserMessageRead(messageId) {
  return apiRequest(`/messages/${encodeURIComponent(messageId)}/read`, {
    method: 'POST',
  });
}

/**
 * Получает список рассылок
 * @param {number} limit - Лимит рассылок
 * @returns {Promise<Array>} Список рассылок
 */
export function listBroadcasts(limit = 100) {
  return apiRequest(`/admin/broadcasts?limit=${encodeURIComponent(limit)}`);
}

/**
 * Создает рассылку
 * @param {Object} payload - Данные рассылки
 * @returns {Promise<Object>} Созданная рассылка
 */
export function createBroadcast(payload) {
  return apiRequest('/admin/broadcasts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Отправляет рассылку
 * @param {string} broadcastId - ID рассылки
 * @returns {Promise<Object>} Результат отправки
 */
export function sendBroadcast(broadcastId) {
  return apiRequest(`/admin/broadcasts/${encodeURIComponent(broadcastId)}/send`, {
    method: 'POST',
  });
}

/**
 * Получает список расписаний рассылок
 * @param {number} limit - Лимит расписаний
 * @returns {Promise<Array>} Список расписаний
 */
export function listBroadcastSchedules(limit = 100) {
  return apiRequest(`/admin/broadcast-schedules?limit=${encodeURIComponent(limit)}`);
}

/**
 * Создает расписание рассылки
 * @param {Object} payload - Данные расписания
 * @returns {Promise<Object>} Созданное расписание
 */
export function createBroadcastSchedule(payload) {
  return apiRequest('/admin/broadcast-schedules', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Запускает расписание рассылки
 * @param {string} scheduleId - ID расписания
 * @returns {Promise<Object>} Результат запуска
 */
export function runBroadcastSchedule(scheduleId) {
  return apiRequest(`/admin/broadcast-schedules/${encodeURIComponent(scheduleId)}/run`, {
    method: 'POST',
  });
}

/**
 * Получает список запланированных задач
 * @returns {Promise<Array>} Список задач
 */
export function listScheduledTasks() {
  return apiRequest('/admin/scheduled-tasks');
}

/**
 * Запускает запланированную задачу
 * @param {string} taskId - ID задачи
 * @returns {Promise<Object>} Результат запуска
 */
export function runScheduledTask(taskId) {
  return apiRequest(`/admin/scheduled-tasks/${encodeURIComponent(taskId)}/run`, {
    method: 'POST',
  });
}

/**
 * Получает логи синхронизации
 * @param {Object} params - Параметры запроса
 * @param {number} params.limit - Лимит записей
 * @param {string} params.task_id - ID задачи
 * @returns {Promise<Array>} Логи синхронизации
 */
export function listSyncLogs(params = {}) {
  const search = new URLSearchParams();
  if (params.limit) search.set('limit', String(params.limit));
  if (params.task_id || params.taskId) search.set('task_id', params.task_id || params.taskId);
  const query = search.toString();
  return apiRequest(`/admin/sync-logs${query ? `?${query}` : ''}`);
}

/**
 * Получает статус синхронизации
 * @returns {Promise<Object>} Статус синхронизации
 */
export function getSyncStatus() {
  return apiRequest('/admin/sync-status');
}
