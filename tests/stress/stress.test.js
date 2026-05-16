import { loadConfig } from '../../lib/helpers.js';
import { buildOptions } from '../../lib/options.js';
import { shipmentsScenario } from '../../scenarios/shipments.js';
import { createTripScenario } from '../../scenarios/create-trip.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const config = loadConfig();

export const options = buildOptions(config, 'stress');

// Stress test: push beyond normal load to find breaking point
// Purpose: Discover at what VU count the system degrades or fails
// Watch for: error rate spike, response time jump, 5xx responses

export default function () {
  shipmentsScenario(config.baseUrl);
  createTripScenario(config.baseUrl, config.clickpostBaseUrl);
}

export function handleSummary(data) {
  return {
    './reports/stress-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
