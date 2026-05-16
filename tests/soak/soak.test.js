import { loadConfig } from '../../lib/helpers.js';
import { buildOptions } from '../../lib/options.js';
import { shipmentsScenario } from '../../scenarios/shipments.js';
import { createTripScenario } from '../../scenarios/create-trip.js';
import { Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const config = loadConfig();

// Track if response time drifts upward over time — key soak metric
const responseOverTime = new Trend('response_over_time', true);

export const options = buildOptions(config, 'soak');

// Soak test: normal load for 4 hours
// Purpose: Catch memory leaks, connection pool exhaustion, gradual degradation
// Warning: This takes 4+ hours — only run intentionally

export default function () {
  const start = Date.now();
  shipmentsScenario(config.baseUrl);
  createTripScenario(config.baseUrl, config.clickpostBaseUrl);
  responseOverTime.add(Date.now() - start);
}

export function handleSummary(data) {
  return {
    './reports/soak-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
