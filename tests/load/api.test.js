import { loadConfig } from '../../lib/helpers.js';
import { buildOptions } from '../../lib/options.js';
import { shipmentsScenario } from '../../scenarios/shipments.js';
import { createTripScenario } from '../../scenarios/create-trip.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const config = loadConfig();

export const options = buildOptions(config, 'load');

// Load test: normal expected traffic
// Purpose: Verify system handles day-to-day load without degradation
export default function () {
  shipmentsScenario(config.baseUrl);
  createTripScenario(config.baseUrl, config.clickpostBaseUrl);
}

export function handleSummary(data) {
  return {
    './reports/load-report.html': htmlReport(data),
    './reports/load-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
