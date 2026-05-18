import http from 'k6/http';
import { check } from 'k6';
import { loadConfig } from '../../lib/helpers.js';
import { getEnvPrefix } from '../../lib/helpers.js';

const config = loadConfig();

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  const env      = getEnvPrefix();
  const email    = __ENV[`${env}_ADMIN_USER`];
  const password = __ENV[`${env}_ADMIN_PASS`];
  const xApiKey  = __ENV[`${env}_X_API_KEY`] || '';

  // Step 1 — Login
  const loginRes = http.post(
    `${config.baseUrl}/api/1/auth/login/`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json', 'x-api-key': xApiKey } }
  );

  const loginOk = check(loginRes, {
    'login status 200':  (r) => r.status === 200,
    'token received':    (r) => r.json('data.access') !== null,
  });

  if (!loginOk) {
    console.error(`Login FAILED — status: ${loginRes.status} | body: ${loginRes.body}`);
    return;
  }

  const token = loginRes.json('data.access');
  console.log(`Login OK — token received`);

  // Step 2 — Hit shipments endpoint
  const shipRes = http.post(
    `${config.baseUrl}/app/api/shipments/`,
    JSON.stringify({ page: 1, page_size: 10, slotted_filter: 'all' }),
    { headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-api-key': xApiKey,
    }},
  );

  check(shipRes, {
    'shipments status 200': (r) => r.status === 200,
  });

  console.log(`Shipments — status: ${shipRes.status}`);
}
