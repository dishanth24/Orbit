# Orbit Smoke Test Script (PowerShell)
$ErrorActionPreference = "Stop"
$BaseUrl = "http://127.0.0.1:8000"

Write-Host "=== Orbit Smoke Test (PowerShell) ===" -ForegroundColor Cyan

# 1. Health check
Write-Host "1. Health check: /api/health"
$health = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get
if ($health.ok -ne $true) { throw "Health check failed!" }
Write-Host "   Health OK" -ForegroundColor Green

# 2. Demo load
Write-Host "2. Load demo data: POST /api/demo"
$demo = Invoke-RestMethod -Uri "$BaseUrl/api/demo" -Method Post
if ($demo.days_added -lt 1) { throw "Demo load failed!" }
Write-Host "   Loaded $($demo.days_added) days" -ForegroundColor Green

# 3. Insights
Write-Host "3. Insights check: GET /api/insights"
$insights = Invoke-RestMethod -Uri "$BaseUrl/api/insights" -Method Get
if ($null -eq $insights.score) { throw "Insights score missing!" }
Write-Host "   Orbit Score: $($insights.score)/100 ($($insights.band))" -ForegroundColor Green

# 4. Ask
Write-Host "4. Ask check: POST /api/ask"
$askBody = @{ question = "How did I sleep?" } | ConvertTo-Json
$ask = Invoke-RestMethod -Uri "$BaseUrl/api/ask" -Method Post -Body $askBody -ContentType "application/json"
if (-not $ask.answer) { throw "Ask answer missing!" }
Write-Host "   Ask Answer: $($ask.answer.Substring(0, [Math]::Min(60, $ask.answer.Length)))..." -ForegroundColor Green

# 5. Privacy payload
Write-Host "5. Privacy payload check: GET /api/privacy/payload"
$payload = Invoke-RestMethod -Uri "$BaseUrl/api/privacy/payload" -Method Get
if ($payload.PSObject.Properties.Name -contains "date" -or $payload.PSObject.Properties.Name -contains "records") {
    throw "Privacy payload leaked raw dates or records!"
}
Write-Host "   Privacy payload verified: $($payload.avg_steps) avg steps, zero raw dates" -ForegroundColor Green

Write-Host "=== ALL SMOKE CHECKS PASSED SUCCESSFULLY ===" -ForegroundColor Green
