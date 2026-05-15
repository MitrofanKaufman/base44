import { createActivitySession, sendActivityHeartbeat } from '@/lib/adminApi';

const HEARTBEAT_INTERVAL_MS = 60_000;
const SESSION_STORAGE_KEY = 'velocis_activity_session_id';

let heartbeatTimer = null;

function getSessionId() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
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
  const sessionId = getSessionId();
  if (!sessionId) return;

  try {
    await sendActivityHeartbeat(currentPayload());
  } catch {
    // Heartbeat is best-effort and must not interrupt user workflows.
  }
}

export async function startActivityHeartbeat() {
  if (typeof window === 'undefined') return;
  stopActivityHeartbeat();
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);

  try {
    const response = await createActivitySession(currentPayload());
    const sessionId = response?.session?.sessionId || response?.session?.session_id;
    if (!sessionId) return;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    return;
  }

  sendHeartbeat();
  heartbeatTimer = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
}

export function stopActivityHeartbeat() {
  if (typeof window === 'undefined') return;
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}
