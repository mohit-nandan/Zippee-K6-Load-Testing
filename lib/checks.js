import { check } from 'k6';

// Reusable check patterns — import these instead of repeating check() everywhere

export function checkOk(response, label = 'status is 200') {
  return check(response, {
    [label]: (r) => r.status === 200,
  });
}

// For Zippee write endpoints that return 200/201 + { result: true }
export function checkZippeeSuccess(response, label) {
  return check(response, {
    [label]: (r) => {
      if (r.status < 200 || r.status >= 300) return false;
      try {
        const b = r.json();
        return b && b.result === true;
      } catch (_) {
        return false;
      }
    },
  });
}

export function checkCreated(response, label = 'status is 201') {
  return check(response, {
    [label]: (r) => r.status === 201,
    'has id in response': (r) => JSON.parse(r.body).id !== undefined,
  });
}

export function checkNotEmpty(response) {
  return check(response, {
    'status is 200': (r) => r.status === 200,
    'body is not empty': (r) => r.body && r.body.length > 0,
  });
}

export function checkUnauthorized(response) {
  return check(response, {
    'returns 401': (r) => r.status === 401,
  });
}
