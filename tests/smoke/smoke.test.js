import { loadConfig } from '../../lib/helpers.js';
import { buildOptions } from '../../lib/options.js';
import { shipmentsScenario } from '../../scenarios/shipments.js';
import { createTripScenario } from '../../scenarios/create-trip.js';

const config = loadConfig();

export const options = buildOptions(config, 'smoke');

// Smoke test: 1 VU, 1 iteration
// Purpose: Confirm the API is UP and core flows work before any real test
// Run this first — if this fails, don't run load/stress
export default function () {
  shipmentsScenario(config.baseUrl);
  createTripScenario(config.baseUrl, config.clickpostBaseUrl);
}
