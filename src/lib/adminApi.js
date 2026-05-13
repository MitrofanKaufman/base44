import { apiRequest } from '@/api/base44Client';

export function getAdminMetrics() {
  return apiRequest('/admin/metrics');
}

export function sendActivityHeartbeat(payload) {
  return apiRequest('/activity/heartbeat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listUserMessages(limit = 50) {
  return apiRequest(`/messages?limit=${encodeURIComponent(limit)}`);
}

export function markUserMessageRead(messageId) {
  return apiRequest(`/messages/${encodeURIComponent(messageId)}/read`, {
    method: 'POST',
  });
}

export function listBroadcasts(limit = 100) {
  return apiRequest(`/admin/broadcasts?limit=${encodeURIComponent(limit)}`);
}

export function createBroadcast(payload) {
  return apiRequest('/admin/broadcasts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function sendBroadcast(broadcastId) {
  return apiRequest(`/admin/broadcasts/${encodeURIComponent(broadcastId)}/send`, {
    method: 'POST',
  });
}

export function listBroadcastSchedules(limit = 100) {
  return apiRequest(`/admin/broadcast-schedules?limit=${encodeURIComponent(limit)}`);
}

export function createBroadcastSchedule(payload) {
  return apiRequest('/admin/broadcast-schedules', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function runBroadcastSchedule(scheduleId) {
  return apiRequest(`/admin/broadcast-schedules/${encodeURIComponent(scheduleId)}/run`, {
    method: 'POST',
  });
}
