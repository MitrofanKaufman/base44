/** @param {any} value */
const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

/**
 * @param {any} run
 * @returns {{rawFrameCount:number,eventCount:number,productSnapshotCount:number,sellerSnapshotCount:number,unitEconomicsCount:number,deadLetterCount:number,eventsProcessed:number,eventsError:number}}
 */
export function readRunCounters(run = {}) {
  const counters = run.counters || {};
  const eventCount = toNumber(counters.eventCount ?? counters.eventsProcessed ?? run.eventCount ?? run.eventsProcessed);
  const deadLetterCount = toNumber(counters.deadLetterCount ?? counters.eventsError ?? run.deadLetterCount ?? run.eventsError);

  return {
    rawFrameCount: toNumber(counters.rawFrameCount ?? run.rawFrameCount),
    eventCount,
    productSnapshotCount: toNumber(counters.productSnapshotCount ?? run.productSnapshotCount),
    sellerSnapshotCount: toNumber(counters.sellerSnapshotCount ?? run.sellerSnapshotCount),
    unitEconomicsCount: toNumber(counters.unitEconomicsCount ?? run.unitEconomicsCount),
    deadLetterCount,
    eventsProcessed: toNumber(counters.eventsProcessed ?? eventCount),
    eventsError: toNumber(counters.eventsError ?? deadLetterCount),
  };
}

export const INGESTION_STAGES = [
  'validate-input',
  'collect-marketplace-data',
  'normalize-events',
  'save-raw-frames',
  'save-events',
  'update-snapshots',
  'calculate-unit-economics',
  'verify-results',
  'build-report',
];

/**
 * @param {any} run
 * @returns {Array<any>}
 */
export function normalizeRunTimeline(run = {}) {
  const timeline = Array.isArray(run.timeline) ? run.timeline : [];
  if (timeline.length > 0) {
    return timeline.map((stage) => ({
      stage: stage.stage || 'unknown',
      status: stage.status || 'pending',
      startedAt: stage.startedAt || null,
      finishedAt: stage.finishedAt || null,
      durationMs: toNumber(stage.durationMs),
      error: stage.error || null,
    }));
  }

  return INGESTION_STAGES.map((stage) => ({
    stage,
    status: run.currentStage === stage && run.status === 'running' ? 'running' : 'pending',
    startedAt: null,
    finishedAt: null,
    durationMs: 0,
    error: null,
  }));
}

/**
 * @param {any} run
 * @returns {any}
 */
export function normalizeIngestionRun(run = {}) {
  return {
    ...run,
    counters: readRunCounters(run),
    timeline: normalizeRunTimeline(run),
  };
}

/**
 * @param {any[]} runs
 * @returns {any[]}
 */
export function normalizeIngestionRuns(runs = []) {
  return (Array.isArray(runs) ? runs : []).map(normalizeIngestionRun);
}
