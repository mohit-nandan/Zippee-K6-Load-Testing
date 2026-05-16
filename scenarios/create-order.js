import http from 'k6/http';
import { check, sleep } from 'k6';
import { checkOk } from '../lib/checks.js';
import { createOrderDuration, errorCount, apiErrorRate } from '../lib/metrics.js';
import { uniqueId, getEnvPrefix } from '../lib/helpers.js';

// Cached Clickpost token per VU — login once, reuse across iterations
let cachedClickpostToken = null;

function loginClickpost(clickpostBaseUrl, apiKey, username, password) {
  const res = http.post(
    `${clickpostBaseUrl}/api/1/mainsite/token`,
    JSON.stringify({ username, password }),
    { headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey } }
  );
  check(res, { 'clickpost login ok': (r) => r.status === 200 });
  const body = res.json();
  // Handles both { token: "..." } and { data: { token: "..." } } response shapes
  return body ? (body.token || (body.data && (body.data.token || body.data.access)) || null) : null;
}

// Scenario: Create a Clickpost shipment order (seeds AWB into zorms_shipment table)
// reference_code is unique per call — reuse of the same code returns the same AWB
// is_cod is randomised: 50% PREPAID, 50% COD
// Returns the AWB string on success, null on failure
export function createOrderScenario(clickpostBaseUrl, envPrefix) {
  const env      = envPrefix || getEnvPrefix();
  const apiKey   = __ENV[`${env}_CLICKPOST_API_KEY`];
  const username = __ENV[`${env}_CLICKPOST_USERNAME`];
  const password = __ENV[`${env}_CLICKPOST_PASS`];

  if (!cachedClickpostToken) {
    cachedClickpostToken = loginClickpost(clickpostBaseUrl, apiKey, username, password);
  }
  if (!cachedClickpostToken) {
    errorCount.add(1);
    apiErrorRate.add(1);
    return null;
  }

  const isCod = Math.random() < 0.5;
  const refCode = `REF-K6-${uniqueId()}`;

  const start = Date.now();
  const res = http.post(
    `${clickpostBaseUrl}/api/1/mainsite/shipment/create`,
    JSON.stringify({
      reference_code: refCode,
      original_reference_code: `ORIG-${refCode}`,
      order_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      reverse_pickup: false,
      shipment_type: 'FORWARD',
      multi_select: false,
      is_tnb: false,
      meta: { tags: [isCod ? 'COD' : 'PREPAID'] },
      delivery_details: {
        name: 'Load Test Customer',
        contact_num: '9123456780',
        address_line_1: 'Hastings Ave, Azad Nagar, Nawabganj, Kanpur, Uttar Pradesh 208002',
        address_line_2: 'Kanpur',
        city: 'Kanpur',
        state: 'Uttar Pradesh',
        country: 'India',
        latitude: 26.4843968,
        longitude: 80.269205,
        email: 'loadtest@zfwhospitality.com',
        pin_code: '122008',
      },
      return_details: {
        name: 'Darkstore Returns',
        contact_num: '9532385430',
        address_line_1: 'okhla',
        address_line_2: 'Delhi',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
        latitude: 28.4940959,
        longitude: 77.0927495,
        email: 'returns@zfwhospitality.com',
        pin_code: '110002',
      },
      pickup_details: {
        name: 'Load Test Pickup',
        contact_num: '9140151251',
        address_line_1: 'Taj Mahal, Eastern Gate, Forest Colony, Tajganj, Agra, Uttar Pradesh 282001',
        address_line_2: 'Agra',
        city: 'Agra',
        state: 'Uttar Pradesh',
        country: 'India',
        latitude: 27.171088,
        longitude: 78.0409694,
        email: 'pickup@zfwhospitality.com',
        pin_code: '560034',
      },
      cod_details: {
        is_cod: isCod,
        collectable_amount: isCod ? 100 : 0,
        total_value: 200,
        dynamic_adjustment_required: false,
        miscellaneous_charges: { handling_fee: 10, packing_cost: 10, priority_fee: 10 },
      },
      package_weight: 700,
      package_length: 40,
      package_width: 28,
      package_height: 20,
      order_items: [
        {
          item_quantity: 2,
          selling_price: 100,
          sku: `SKU-K6-${uniqueId()}`,
          product_name: 'Load Test Product',
          description: 'k6 load test item',
          mrp: 199,
          ean: `EAN-K6-${Date.now()}`,
          category: 'Beverages',
          is_returnable: false,
          image: 'https://images.pexels.com/photos/25811351/pexels-photo-25811351.jpeg',
          meta: { flavor: 'test', weight: '150g', origin: 'India', packaging: 'paper box' },
        },
      ],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
        Authorization: `Bearer ${cachedClickpostToken}`,
      },
    }
  );
  createOrderDuration.add(Date.now() - start);

  const ok = checkOk(res, `clickpost order created [${isCod ? 'COD' : 'PREPAID'}]`);
  if (!ok) {
    errorCount.add(1);
    apiErrorRate.add(1);
    return null;
  }

  const body = res.json();
  const awb = body && body.data ? body.data.awb : null;
  sleep(1);
  return awb;
}
