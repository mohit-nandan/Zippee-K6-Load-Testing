import { SharedArray } from 'k6/data';

// Load a JSON data file once and share across all VUs
export function loadData(name, filePath) {
  return new SharedArray(name, () => JSON.parse(open(filePath)));
}

// Pick a random item from an array
export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate a random integer between min and max (inclusive)
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate a unique-ish string (for creating test records)
export function uniqueId() {
  return `k6-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Load config file — CONFIG_FILE must be a name like "staging", "preprod", or "prod"
// Path is always resolved relative to this file (lib/), never the test entry point
export function loadConfig() {
  const name = __ENV.CONFIG_FILE || 'staging';
  return JSON.parse(open(import.meta.resolve(`../config/${name}.json`)));
}

// Derives the .env prefix (STAGING / PREPROD / PROD) from CONFIG_FILE env var
export function getEnvPrefix() {
  const cfg = __ENV.CONFIG_FILE || '';
  if (cfg.includes('preprod')) return 'PREPROD';
  if (cfg.includes('prod'))    return 'PROD';
  return 'STAGING';
}
