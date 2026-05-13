import { sendActivityHeartbeat } from '@/lib/adminApi';

const HEARTBEAT_INTERVAL_MS = 60_000;
const SESSION_STORAGE_KEY = 'velocis_activity_session_id';

let heartbeatTimer = null;

function getSessionId() {
  if (typeof window === 'undefined') return 'server-session';
  const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;

  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  return id;
}

function currentPayload() {
  if (typeof window === 'undefined') {
    return { session_id: getSessionId(), path: '/' };
  }
  return {
    session_id: getSessionId(),
    path: `${window.location.pathname}${window.location.search}`,
  };
}

async function sendHeartbeat() {
  try {
    await sendActivityHeartbeat(currentPayload());
  } catch {
    // Heartbeat is best-effort and must not interrupt user workflows.
  }
}

export function startActivityHeartbeat() {
  if (typeof window === 'undefined') return;
  stopActivityHeartbeat();
  sendHeartbeat();
  heartbeatTimer = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
}

export function stopActivityHeartbeat() {
  if (typeof window === 'undefined') return;
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
