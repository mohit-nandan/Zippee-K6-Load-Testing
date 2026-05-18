import { loadConfig } from '../../lib/helpers.js';
import { shipmentsScenario } from '../../scenarios/shipments.js';

const config = loadConfig();
const ENV         = __ENV.CONFIG_FILE   || 'staging';
const DEPLOY_LABEL = __ENV.DEPLOY_LABEL || 'unknown';

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'],
  stages: [
    { duration: '2m', target: config.vus.load },
    { duration: '5m', target: config.vus.load },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    'http_req_duration': [
      `p(95)<${config.thresholds.p95}`,
      `p(99)<${config.thresholds.p99}`,
    ],
    'http_req_failed': [`rate<${config.thresholds.errorRate}`],
    'checks':          ['rate>0.95'],
  },
};

export default function () {
  shipmentsScenario(config.baseUrl);
}

// Runs automatically after the test finishes.
// Saves a JSON file to baselines/ with the key metrics.
// Filename format: baselines/YYYY-MM-DD-{env}-{deploy}.json
export function handleSummary(data) {
  const date     = new Date().toISOString().slice(0, 10);
  const filename = `baselines/${date}-${ENV}-${DEPLOY_LABEL}.json`;

  const m = data.metrics;

  const summary = {
    date:        new Date().toISOString(),
    environment: ENV,
    deploy:      DEPLOY_LABEL,
    vus:         config.vus.load,
    results: {
      http_req_duration_p95_ms: Math.round(m.http_req_duration?.values?.['p(95)'] ?? 0),
      http_req_duration_p99_ms: Math.round(m.http_req_duration?.values?.['p(99)'] ?? 0),
      http_req_duration_avg_ms: Math.round(m.http_req_duration?.values?.avg       ?? 0),
      error_rate_percent:       +((m.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2),
      rps:                      +((m.http_reqs?.values?.rate        ?? 0)).toFixed(2),
      total_requests:            m.http_reqs?.values?.count ?? 0,
      checks_pass_rate:         +((m.checks?.values?.rate   ?? 0) * 100).toFixed(2),
    },
    thresholds_passed: !Object.values(m).some(
      (metric) => metric.thresholds &&
        Object.values(metric.thresholds).some((t) => t.ok === false)
    ),
  };

  return {
    [filename]: JSON.stringify(summary, null, 2),
    stdout: `\nBaseline saved → ${filename}\n`,
  };
}
