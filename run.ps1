# Usage:
#   .\run.ps1 smoke
#   .\run.ps1 load
#   .\run.ps1 stress
#   .\run.ps1 soak
#   .\run.ps1 smoke preprod
#   .\run.ps1 load prod

param(
    [Parameter(Mandatory)][ValidateSet('smoke','load','stress','soak','baseline')][string]$Test,
    [ValidateSet('staging','preprod','prod')][string]$Env = 'staging',
    [string]$Deploy = 'unknown'
)

# Load .env into current session
Get-Content .env | Where-Object { $_ -match '^[A-Z]' } | ForEach-Object {
    $parts = $_ -split '=', 2
    [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), 'Process')
}

$testFile = switch ($Test) {
    'smoke'    { 'tests/smoke/smoke.test.js' }
    'load'     { 'tests/load/api.test.js' }
    'stress'   { 'tests/stress/stress.test.js' }
    'soak'     { 'tests/soak/soak.test.js' }
    'baseline' { 'tests/baseline/baseline.test.js' }
}

Write-Host "Running $Test test against $Env..." -ForegroundColor Cyan

if ($Test -eq 'baseline') {
    Write-Host "Deploy label: $Deploy" -ForegroundColor Yellow
    Write-Host "Streaming to local Grafana + k6 Cloud..." -ForegroundColor Yellow
    k6 run --out influxdb=http://localhost:8086/k6 --out cloud --env CONFIG_FILE=$Env --env DEPLOY_LABEL=$Deploy $testFile
} else {
    k6 run --out influxdb=http://localhost:8086/k6 --env CONFIG_FILE=$Env $testFile
}
