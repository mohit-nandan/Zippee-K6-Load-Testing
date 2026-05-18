import { loadConfig } from '../../lib/helpers.js';
import { shipmentsScenario } from '../../scenarios/shipments.js';

const config = loadConfig();

export const options = {
  stages: [
    { duration: '10s', target: 100 }, // instant spike — no gradual ramp
    { duration: '1m',  target: 100 }, // hold at 100 VUs for 1 minute
    { duration: '10s', target: 0   }, // instant drop
    { duration: '30s', target: 0   }, // watch recovery — does error rate return to 0?
  ],
  thresholds: {
    // Relaxed thresholds for spike — some stress is expected
    http_req_duration: ['p(95)<10000'],  // 10s max during spike
    http_req_failed:   ['rate<0.20'],    // allow up to 20% errors during spike
  },
};

export default function () {
  shipmentsScenario(config.baseUrl);
}
