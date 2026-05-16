import http from 'k6/http';
import { check } from 'k6';

// Reads credentials from ENV based on environment prefix (STAGING/PREPROD/PROD)
// Usage: const creds = getCredentials('STAGING');
export function getCredentials(env = 'STAGING') {
  return {
    baseUrl:          __ENV[`${env}_BASE_URL`],
    adminUser:        __ENV[`${env}_ADMIN_USER`],
    adminPass:        __ENV[`${env}_ADMIN_PASS`],
    clickpostApiKey:  __ENV[`${env}_CLICKPOST_API_KEY`],
    clickpostUser:    __ENV[`${env}_CLICKPOST_USERNAME`],
    clickpostPass:    __ENV[`${env}_CLICKPOST_PASS`],
    xApiKey:          __ENV[`${env}_X_API_KEY`] || '',
  };
}

// Call this to get a token for authenticated requests
// Usage: const token = login(baseUrl, email, password);
export function login(baseUrl, email, password) {
  const response = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(response, { 'login successful': (r) => r.status === 200 });

  return response.json('token');
}

// Returns headers for authenticated requests
// Pass xApiKey only for prod endpoints that require it
export function authHeaders(token, xApiKey = '') {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (xApiKey) headers['x-api-key'] = xApiKey;
  return { headers };
}
