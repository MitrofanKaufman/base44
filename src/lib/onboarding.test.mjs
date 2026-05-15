import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CALCULATOR_INTRO_PENDING_KEY,
  CALCULATOR_INTRO_TOUR_KEY,
  CALCULATOR_INTRO_TOUR_VERSION,
  buildOnboardingCompletionPayload,
  consumeCalculatorIntroPending,
  markCalculatorIntroPending,
  shouldStartCalculatorIntro,
} from './onboarding.js';

function userWithTour({ version = CALCULATOR_INTRO_TOUR_VERSION, status } = {}) {
  return {
    onboarding_state: {
      [CALCULATOR_INTRO_TOUR_KEY]: {
        version,
        status,
        completed_at: '2026-05-15T00:00:00.000Z',
      },
    },
  };
}

describe('calculator onboarding helpers', () => {
  it('does not start when the current tour version is completed', () => {
    assert.equal(shouldStartCalculatorIntro(userWithTour({ status: 'completed' })), false);
  });

  it('does not start when the current tour version is skipped', () => {
    assert.equal(shouldStartCalculatorIntro(userWithTour({ status: 'skipped' })), false);
  });

  it('starts when the stored version is stale', () => {
    assert.equal(shouldStartCalculatorIntro(userWithTour({ version: 0, status: 'completed' })), true);
  });

  it('starts when onboarding state is missing', () => {
    assert.equal(shouldStartCalculatorIntro({ onboarding_state: {} }), true);
  });

  it('builds the backend completion payload', () => {
    assert.deepEqual(buildOnboardingCompletionPayload('skipped'), {
      tour_key: CALCULATOR_INTRO_TOUR_KEY,
      version: CALCULATOR_INTRO_TOUR_VERSION,
      status: 'skipped',
    });
  });

  it('consumes the pending intro flag once', () => {
    const storage = new Map();
    global.window = {
      sessionStorage: {
        getItem: (key) => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
      },
    };

    markCalculatorIntroPending();

    assert.equal(storage.get(CALCULATOR_INTRO_PENDING_KEY), '1');
    assert.equal(consumeCalculatorIntroPending(), true);
    assert.equal(consumeCalculatorIntroPending(), false);

    delete global.window;
  });
});
