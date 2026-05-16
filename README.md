# Zippee — k6 Load Testing

Production-grade load test suite for the Zippee API.

---

## Project Structure

```
k6-load-tests/
├── .github/workflows/     ← CI/CD pipelines
│   ├── smoke.yml          ← runs on every PR
│   ├── load.yml           ← manual trigger, pick environment
│   └── stress.yml         ← runs every Monday at 2am
├── config/
│   ├── staging.json       ← staging server, moderate thresholds
│   ├── preprod.json       ← pre-production, moderate thresholds
│   └── prod.json          ← production, strict thresholds
├── data/
│   └── users.json         ← test user credentials
├── lib/
│   ├── auth.js            ← login + auth headers helper
│   ├── checks.js          ← reusable response assertions
│   ├── helpers.js         ← data loading, random utils
│   ├── metrics.js         ← all custom metrics in one place
│   └── options.js         ← shared VU/threshold config builder
├── scenarios/
│   ├── health-check.js    ← ping /api/health
│   ├── user-login.js      ← login + profile fetch
│   └── browse-and-order.js← browse items + place order
├── tests/
│   ├── smoke/             ← 1 VU, 1 iteration — run first always
│   ├── load/              ← normal traffic — run before release
│   ├── stress/            ← find the breaking point
│   └── soak/              ← 4hr endurance test
├── dashboards/
│   └── grafana-k6.json    ← import this into Grafana
├── reports/               ← gitignored, generated at runtime
└── docker-compose.yml     ← InfluxDB + Grafana stack
```

---

## Setup

**1. Add your test users to `data/users.json`**

**2. Copy `.env.example` to `.env` and fill in your credentials**

**3. Update the endpoint paths in `scenarios/` to match your real API**

---

## How to Run

```bash
cd k6-load-tests

# Smoke — always run first
k6 run --env-file .env --env CONFIG_FILE=./config/staging.json tests/smoke/smoke.test.js

# Load — staging
k6 run --env-file .env --env CONFIG_FILE=./config/staging.json tests/load/api.test.js

# Load — preprod
k6 run --env-file .env --env CONFIG_FILE=./config/preprod.json tests/load/api.test.js

# Stress — staging
k6 run --env-file .env --env CONFIG_FILE=./config/staging.json tests/stress/stress.test.js

# Soak (4+ hours — run intentionally)
k6 run --env-file .env --env CONFIG_FILE=./config/staging.json tests/soak/soak.test.js
```

## Run with Live Grafana Dashboard

```bash
# Step 1: Start InfluxDB + Grafana
docker-compose up -d

# Step 2: Run k6 with InfluxDB output
k6 run --out influxdb=http://localhost:8086/k6 \
   --env-file .env \
   --env CONFIG_FILE=./config/staging.json \
   tests/load/api.test.js

# Step 3: Open Grafana at http://localhost:3000
```

---

## When to Run Each Test

| Test   | When                          | How Often         |
|--------|-------------------------------|-------------------|
| Smoke  | Every PR, every deploy        | Always            |
| Load   | Before every release          | Per release       |
| Stress | Capacity planning             | Monthly           |
| Soak   | Before major releases         | Quarterly         |

---

## Adding a New Scenario

1. Create `scenarios/your-feature.js` with the user flow
2. Import and call it from `tests/load/api.test.js`
3. Reuse helpers from `lib/` — don't repeat auth/check logic
