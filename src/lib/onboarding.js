export const CALCULATOR_INTRO_TOUR_KEY = 'calculator_intro';
export const CALCULATOR_INTRO_TOUR_VERSION = 1;
export const CALCULATOR_INTRO_PENDING_KEY = 'base44:calculator:intro:pending';

const FINISHED_STATUSES = new Set(['completed', 'skipped']);

export function getOnboardingTourState(user, tourKey = CALCULATOR_INTRO_TOUR_KEY) {
  const state = user?.onboarding_state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  const tourState = state[tourKey];
  return tourState && typeof tourState === 'object' && !Array.isArray(tourState) ? tourState : null;
}

export function isOnboardingTourFinished(
  user,
  tourKey = CALCULATOR_INTRO_TOUR_KEY,
  version = CALCULATOR_INTRO_TOUR_VERSION,
) {
  const tourState = getOnboardingTourState(user, tourKey);
  if (!tourState) return false;

  return Number(tourState.version) === version && FINISHED_STATUSES.has(tourState.status);
}

export function shouldStartCalculatorIntro(user) {
  return !isOnboardingTourFinished(user, CALCULATOR_INTRO_TOUR_KEY, CALCULATOR_INTRO_TOUR_VERSION);
}

export function buildOnboardingCompletionPayload(status = 'completed') {
  return {
    tour_key: CALCULATOR_INTRO_TOUR_KEY,
    version: CALCULATOR_INTRO_TOUR_VERSION,
    status,
  };
}

export function markCalculatorIntroPending() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(CALCULATOR_INTRO_PENDING_KEY, '1');
}

export function consumeCalculatorIntroPending() {
  if (typeof window === 'undefined') return false;
  const isPending = window.sessionStorage.getItem(CALCULATOR_INTRO_PENDING_KEY) === '1';
  window.sessionStorage.removeItem(CALCULATOR_INTRO_PENDING_KEY);
  return isPending;
}
