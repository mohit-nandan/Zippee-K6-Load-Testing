import http from 'k6/http';
import { check, sleep } from 'k6';
import { authHeaders } from '../lib/auth.js';
import { checkOk } from '../lib/checks.js';
import { shipmentsDuration, errorCount, apiErrorRate } from '../lib/metrics.js';
import { randomItem, randomInt, getEnvPrefix } from '../lib/helpers.js';

const FILTERS = ['assign_now', 'assign_later', 'assigned', 'completed', 'return', 'all'];

// Cached per VU — each VU logs in once and reuses the token for all iterations
// Prevents hammering the auth endpoint under load (25 VUs = 25 logins, not 1768)
let cachedToken = null;

function loginZippee(baseUrl, email, password, xApiKey) {
  const res = http.post(
    `${baseUrl}/api/1/auth/login/`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json', 'x-api-key': xApiKey } }
  );
  check(res, { 'login ok': (r) => r.status === 200 });
  const body = res.json();
  return body && body.data ? body.data.access : null;
}

// Scenario: List shipments with random filter + random page
// Covers all 6 slotted_filter values and pages 1–5
// Admin credentials are read from ENV based on the active config environment
export function shipmentsScenario(baseUrl) {
  const env      = getEnvPrefix();
  const email    = __ENV[`${env}_ADMIN_USER`];
  const password = __ENV[`${env}_ADMIN_PASS`];
  const xApiKey  = __ENV[`${env}_X_API_KEY`] || '';

  if (!cachedToken) {
    cachedToken = loginZippee(baseUrl, email, password, xApiKey);
  }
  if (!cachedToken) {
    errorCount.add(1);
    apiErrorRate.add(1);
    return;
  }
  const token = cachedToken;

  const headers = authHeaders(token, xApiKey);
  const filter  = randomItem(FILTERS);
  const page    = randomInt(1, 5);

  const start = Date.now();
  const res = http.post(
    `${baseUrl}/app/api/shipments/`,
    JSON.stringify({ page, page_size: 50, slotted_filter: filter }),
    headers
  );
  shipmentsDuration.add(Date.now() - start);

  const ok = checkOk(res, `shipments [${filter}] page ${page} ok`);
  apiErrorRate.add(ok ? 0 : 1);
  if (!ok) errorCount.add(1);

  sleep(1);
}
