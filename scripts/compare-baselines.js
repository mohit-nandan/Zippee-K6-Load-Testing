// Usage:
//   node scripts/compare-baselines.js baselines/before.json baselines/after.json

const fs = require('fs');

const [,, file1, file2] = process.argv;

if (!file1 || !file2) {
  console.log('\nUsage: node scripts/compare-baselines.js baselines/before.json baselines/after.json\n');
  process.exit(1);
}

const before = JSON.parse(fs.readFileSync(file1, 'utf8'));
const after  = JSON.parse(fs.readFileSync(file2, 'utf8'));

const metrics = [
  { key: 'http_req_duration_p95_ms', label: 'p95 Response Time',    unit: 'ms',  lowerIsBetter: true  },
  { key: 'http_req_duration_p99_ms', label: 'p99 Response Time',    unit: 'ms',  lowerIsBetter: true  },
  { key: 'http_req_duration_avg_ms', label: 'Avg Response Time',    unit: 'ms',  lowerIsBetter: true  },
  { key: 'error_rate_percent',       label: 'Error Rate',           unit: '%',   lowerIsBetter: true  },
  { key: 'rps',                      label: 'Throughput (RPS)',     unit: ' rps',lowerIsBetter: false },
  { key: 'checks_pass_rate',         label: 'Checks Pass Rate',     unit: '%',   lowerIsBetter: false },
];

console.log('\n============================');
console.log('   BASELINE COMPARISON');
console.log('============================');
console.log(`BEFORE : ${before.date.slice(0,10)} | ${before.deploy} | ${before.environment}`);
console.log(`AFTER  : ${after.date.slice(0,10)}  | ${after.deploy}  | ${after.environment}`);
console.log('----------------------------\n');

let hasWarning  = false;
let hasCritical = false;

metrics.forEach(({ key, label, unit, lowerIsBetter }) => {
  const b = before.results[key];
  const a = after.results[key];
  if (b === undefined || a === undefined) return;

  const diffPct = b === 0 ? 0 : ((a - b) / b) * 100;
  const worse   = lowerIsBetter ? diffPct > 0 : diffPct < 0;
  const absDiff = Math.abs(diffPct);
  const arrow   = diffPct > 0 ? '▲' : diffPct < 0 ? '▼' : '=';

  let status = '✅';
  if (worse && absDiff > 25) {
    status = '🔴 CRITICAL';
    hasCritical = true;
    hasWarning  = true;
  } else if (worse && absDiff > 10) {
    status = '🟡 WARNING ';
    hasWarning = true;
  } else if (worse) {
    status = '⚠️  MINOR  ';
  }

  console.log(`${status}  ${label.padEnd(22)} ${String(b).padStart(7)}${unit} → ${String(a).padStart(7)}${unit}  (${arrow}${absDiff.toFixed(1)}%)`);
});

console.log('\n----------------------------');
if (hasCritical) {
  console.log('🔴 RESULT: CRITICAL REGRESSION');
  console.log('   Block the deploy. Investigate immediately.\n');
} else if (hasWarning) {
  console.log('🟡 RESULT: PERFORMANCE WARNING');
  console.log('   Review before promoting to prod.\n');
} else {
  console.log('✅ RESULT: No significant regression');
  console.log('   Safe to deploy.\n');
}
