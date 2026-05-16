import http from 'k6/http';
import { check, sleep } from 'k6';
import { authHeaders } from '../lib/auth.js';
import { checkZippeeSuccess } from '../lib/checks.js';
import { tripDuration, createOrderDuration, errorCount, apiErrorRate } from '../lib/metrics.js';
import { randomInt, uniqueId, getEnvPrefix } from '../lib/helpers.js';

// One token per VU per system — login once, reuse across all iterations
let cachedZippeeToken    = null;
let cachedClickpostToken = null;

function loginZippee(baseUrl, email, password, xApiKey) {
  const res = http.post(
    `${baseUrl}/api/1/auth/login/`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json', 'x-api-key': xApiKey } }
  );
  check(res, { 'zippee login ok': (r) => r.status === 200 });
  try {
    const body = res.json();
    return body && body.data ? body.data.access : null;
  } catch (_) {
    console.error(`Zippee login parse error: status=${res.status}`);
    return null;
  }
}

function loginClickpost(clickpostBaseUrl, apiKey, username, password) {
  const res = http.post(
    `${clickpostBaseUrl}/api/1/mainsite/token`,
    JSON.stringify({ username, password }),
    { headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey } }
  );
  check(res, { 'clickpost login ok': (r) => r.status === 200 });
  try {
    const body = res.json();
    return body ? (body.token || (body.data && (body.data.token || body.data.access)) || null) : null;
  } catch (_) {
    console.error(`Clickpost login parse error: status=${res.status}`);
    return null;
  }
}

// Build a single Clickpost order payload — called per request in a batch
function buildOrderPayload(isCod) {
  const refCode = `REF-K6-${uniqueId()}`;
  return JSON.stringify({
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
  });
}

// Create Clickpost orders in parallel batches — much faster than sequential.
// batchSize = 10 means 10 simultaneous requests per round.
// Returns a Set of AWB strings for all successfully created orders.
function createOrdersBatch(clickpostBaseUrl, apiKey, totalOrders, batchSize) {
  const awbSet  = new Set();
  const headers = {
    'Content-Type': 'application/json',
    'X-API-KEY': apiKey,
    Authorization: `Bearer ${cachedClickpostToken}`,
  };

  for (let offset = 0; offset < totalOrders; offset += batchSize) {
    const count    = Math.min(batchSize, totalOrders - offset);
    const requests = Array.from({ length: count }, () => [
      'POST',
      `${clickpostBaseUrl}/api/1/mainsite/shipment/create`,
      buildOrderPayload(Math.random() < 0.5),
      { headers },
    ]);

    const start     = Date.now();
    const responses = http.batch(requests);
    createOrderDuration.add(Date.now() - start);

    responses.forEach((res) => {
      const ok = check(res, { 'clickpost order created': (r) => r.status === 200 || r.status === 201 });
      if (ok) {
        const body = res.json();
        const awb  = body && body.data ? body.data.awb : null;
        if (awb) awbSet.add(awb);
      }
    });
  }

  return awbSet;
}

// Fetch all pages of assign_now, filtered to only the AWBs we created this iteration.
// Zippee stores the Clickpost AWB in the `zippee_awb` field.
function fetchOrderIdsForAwbs(baseUrl, headers, awbSet) {
  const ids  = [];
  let   page = 1;

  while (ids.length < awbSet.size) {
    const res = http.post(
      `${baseUrl}/app/api/shipments/`,
      JSON.stringify({ page, page_size: 100, slotted_filter: 'assign_now' }),
      headers
    );
    if (res.status !== 200) break;

    const body  = res.json();
    const items = (body && body.data && body.data.results) || [];
    if (!Array.isArray(items) || items.length === 0) break;

    items
      .filter((s) => s.order_status === 'READY' && s.trip_id === null && awbSet.has(s.zippee_awb))
      .forEach((s) => { if (s.order_id) ids.push({ order_id: s.order_id, darkstore: s.darkstore_name }); });

    if (items.length < 100) break;
    page++;
  }

  return ids;
}

// Create one trip from the given shipment IDs
function createTrip(baseUrl, headers, ids) {
  const start = Date.now();
  const res = http.post(
    `${baseUrl}/app/api/trip/create/`,
    JSON.stringify({ shipment_id: ids }),
    headers
  );
  tripDuration.add(Date.now() - start);

  const ok = checkZippeeSuccess(res, `trip create [${ids.length} shipments] ok`);
  apiErrorRate.add(ok ? 0 : 1);
  if (!ok) errorCount.add(1);
  return ok;
}

// Full E2E scenario:
//
//   Phase 1 — Create Clickpost orders in parallel batches
//     Fire 10 orders at a time using http.batch() — parallel, not sequential.
//     Total: 50–100 orders per iteration. At 10 per batch = 5–10 rounds.
//     Each round takes ~670ms (smoke) instead of 10 × 670ms = 6.7s sequential.
//
//   Phase 2 — Wait for AWBs to land in Zippee
//     sleep(8s) — system time to process all incoming AWBs.
//
//   Phase 3 — Fetch only our AWBs from assign_now
//     Filters assign_now by zippee_awb to guarantee fresh, unassigned shipments.
//
//   Phase 4 — Create 5–15 trips with 10–50 shipments each
//     Simulates a real dispatch batch: many riders, varied workloads.
export function createTripScenario(baseUrl, clickpostBaseUrl) {
  const env      = getEnvPrefix();
  const email    = __ENV[`${env}_ADMIN_USER`];
  const password = __ENV[`${env}_ADMIN_PASS`];
  const xApiKey  = __ENV[`${env}_X_API_KEY`] || '';

  const cpApiKey   = __ENV[`${env}_CLICKPOST_API_KEY`];
  const cpUsername = __ENV[`${env}_CLICKPOST_USERNAME`];
  const cpPassword = __ENV[`${env}_CLICKPOST_PASS`];

  // --- Login (once per VU) ---
  // Stagger first-time logins so 25 VUs don't all hit Clickpost simultaneously on ramp-up
  if (!cachedZippeeToken || !cachedClickpostToken) {
    sleep(Math.random() * 3);
  }

  if (!cachedZippeeToken) {
    cachedZippeeToken = loginZippee(baseUrl, email, password, xApiKey);
  }
  if (!cachedZippeeToken) {
    errorCount.add(1); apiErrorRate.add(1); return;
  }

  if (!cachedClickpostToken) {
    cachedClickpostToken = loginClickpost(clickpostBaseUrl, cpApiKey, cpUsername, cpPassword);
  }
  if (!cachedClickpostToken) {
    errorCount.add(1); apiErrorRate.add(1); return;
  }

  const zippeeHeaders = authHeaders(cachedZippeeToken, xApiKey);

  // --- Phase 1: Create orders in parallel batches of 10 ---
  const totalOrders = randomInt(50, 100);
  const awbSet      = createOrdersBatch(clickpostBaseUrl, cpApiKey, totalOrders, 10);

  if (awbSet.size === 0) {
    errorCount.add(1); apiErrorRate.add(1); return;
  }

  // --- Phase 2: Wait for AWBs to land ---
  sleep(8);

  // --- Phase 3: Fetch only our freshly created shipments ---
  const ids = fetchOrderIdsForAwbs(baseUrl, zippeeHeaders, awbSet);

  if (ids.length === 0) {
    console.warn(`No assign_now shipments found for ${awbSet.size} created AWBs`);
    return;
  }

  // --- Phase 4: Group by darkstore, create 5–15 trips per darkstore ---
  // All shipments in a trip MUST belong to the same darkstore — API enforces this.
  // Grouping guarantees no cross-darkstore trips regardless of how AWBs are routed.
  const byDarkstore = {};
  ids.forEach(({ order_id, darkstore }) => {
    const key = darkstore || 'unknown';
    if (!byDarkstore[key]) byDarkstore[key] = [];
    byDarkstore[key].push(order_id);
  });

  Object.values(byDarkstore).forEach((pool) => {
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    const numTrips = Math.min(randomInt(5, 15), shuffled.length);
    let   offset   = 0;

    for (let i = 0; i < numTrips && offset < shuffled.length; i++) {
      const remaining = shuffled.length - offset;
      const tripSize  = Math.min(randomInt(10, 50), remaining);
      const tripIds   = shuffled.slice(offset, offset + tripSize);
      offset += tripSize;

      createTrip(baseUrl, zippeeHeaders, tripIds);
      sleep(1);
    }
  });
}
