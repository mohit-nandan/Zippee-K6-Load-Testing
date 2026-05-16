// Shared options builder — call this in each test file
// Pass the loaded config object and test type to get the right options back

export function buildOptions(config, type = 'load') {
  const thresholds = {
    'http_req_duration': [
      `p(95)<${config.thresholds.p95}`,
      `p(99)<${config.thresholds.p99}`,
    ],
    'http_req_failed': [`rate<${config.thresholds.errorRate}`],
    'checks':          ['rate>0.95'],
  };

  const profiles = {
    smoke: {
      vus: 1,
      iterations: 1,
      thresholds,
    },

    load: {
      stages: [
        { duration: '2m', target: config.vus.load },
        { duration: '5m', target: config.vus.load },
        { duration: '2m', target: 0 },
      ],
      thresholds,
    },

    stress: {
      stages: [
        { duration: '2m', target: config.vus.load },
        { duration: '5m', target: config.vus.load },
        { duration: '2m', target: config.vus.stress },
        { duration: '5m', target: config.vus.stress },
        { duration: '5m', target: 0 },
      ],
      thresholds: {
        ...thresholds,
        'http_req_failed': ['rate<0.10'], // relaxed for stress
      },
    },

    soak: {
      stages: [
        { duration: '5m',  target: config.vus.soak },
        { duration: '4h',  target: config.vus.soak },
        { duration: '5m',  target: 0 },
      ],
      thresholds,
    },
  };

  return profiles[type];
}
