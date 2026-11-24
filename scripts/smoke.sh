#!/usr/bin/env bash
# Orbit Smoke Test Script
set -e

PORT=8000
BASE_URL="http://127.0.0.1:${PORT}"

echo "=== Orbit Smoke Test ==="
echo "1. Checking if server is already running..."
if curl -s "${BASE_URL}/api/health" | grep -q '"ok":true'; then
  echo "Server is running at ${BASE_URL}."
else
  echo "Starting backend server..."
  python -m uvicorn main:app --port ${PORT} &
  SERVER_PID=$!
  trap "kill $SERVER_PID" EXIT
  sleep 3
fi

echo "2. Health check: /api/health"
HEALTH=$(curl -s "${BASE_URL}/api/health")
echo "Response: $HEALTH"
echo "$HEALTH" | grep -q '"ok":true' || (echo "Health check failed!" && exit 1)

echo "3. Load demo data: POST /api/demo"
DEMO=$(curl -s -X POST "${BASE_URL}/api/demo")
echo "Response: $DEMO"
echo "$DEMO" | grep -q '"days_added"' || (echo "Demo load failed!" && exit 1)

echo "4. Insights check: GET /api/insights"
INSIGHTS=$(curl -s "${BASE_URL}/api/insights")
echo "$INSIGHTS" | grep -q '"score"' || (echo "Insights check failed!" && exit 1)

echo "5. Ask check: POST /api/ask"
ASK=$(curl -s -X POST "${BASE_URL}/api/ask" -H "Content-Type: application/json" -d '{"question":"How did I sleep?"}')
echo "Response: $ASK"
echo "$ASK" | grep -q '"answer"' || (echo "Ask check failed!" && exit 1)

echo "6. Privacy payload check: GET /api/privacy/payload"
PAYLOAD=$(curl -s "${BASE_URL}/api/privacy/payload")
echo "Response: $PAYLOAD"
echo "$PAYLOAD" | grep -q '"avg_steps"' || (echo "Privacy payload failed!" && exit 1)
# Assert no forbidden keys in payload
echo "$PAYLOAD" | grep -iv '"date"' | grep -iv '"records"' | grep -iv '"rows"' || (echo "Privacy payload leaked raw data!" && exit 1)

echo "=== ALL SMOKE CHECKS PASSED SUCCESSFULLY ==="
