import { loadConfig } from '../../lib/helpers.js';
import { shipmentsScenario } from '../../scenarios/shipments.js';

const config = loadConfig();

// Breakpoint test — slowly adds VUs every 2 minutes until the system breaks.
// The VU count where errors first appear = your system's capacity limit.
//
// Auto-stops when error rate exceeds 15% for 10 seconds — no point hammering
// a broken server. The last stage that was PASSING = your breakpoint.
//
// Expected total duration: ~18 minutes (or less if system breaks early)
// Only run against staging — NEVER prod.

export const options = {
  stages: [
    { duration: '2m', target: 5  },
    { duration: '2m', target: 10 },
    { duration: '2m', target: 15 },
    { duration: '2m', target: 20 },
    { duration: '2m', target: 25 },
    { duration: '2m', target: 35 },
    { duration: '2m', target: 50 },
    { duration: '2m', target: 65 },
    { duration: '2m', target: 0  }, // ramp down + watch recovery
  ],
  thresholds: {
    // abortOnFail stops the test automatically when error rate > 15%
    // delayAbortEval waits 10s before aborting — filters out brief spikes
    http_req_failed: [{
      threshold:      'rate<0.15',
      abortOnFail:    true,
      delayAbortEval: '10s',
    }],
    http_req_duration: ['p(95)<15000'],
  },
};

export default function () {
  shipmentsScenario(config.baseUrl);
}
