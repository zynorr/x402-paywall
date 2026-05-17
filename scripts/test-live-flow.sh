#!/bin/bash
# Test the x402 Paywall live flow against GOAT Testnet3
# Usage: bash scripts/test-live-flow.sh

BASE_URL="${1:-http://localhost:3001}"
IDENTITY="${2:-test_user_$(date +%s)}"

echo "╔══════════════════════════════════════════════════════╗"
echo "║      x402 Paywall — Live Flow Test                  ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Target:  $BASE_URL"
echo "║  Identity: $IDENTITY"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Step 1: Health check
echo "=== Step 1: Health Check ==="
HEALTH_RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL/api/health" 2>&1)
HEALTH_CODE=$(echo "$HEALTH_RESULT" | grep 'HTTP_CODE:' | sed 's/.*HTTP_CODE://')
HEALTH_BODY=$(echo "$HEALTH_RESULT" | grep -v 'HTTP_CODE:')
echo "$HEALTH_BODY" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_BODY"
echo ""

# Step 2: GET premium-data (should get 402)
echo "=== Step 2: GET /api/premium-data (expect 402) ==="
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -H "X-Caller-Identity: $IDENTITY" "$BASE_URL/api/premium-data" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | grep 'HTTP_CODE:' | sed 's/.*HTTP_CODE://')
BODY=$(echo "$RESPONSE" | grep -v 'HTTP_CODE:')
echo "HTTP $HTTP_CODE"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "(raw) $BODY"
echo ""

if [ "$HTTP_CODE" != "402" ]; then
  echo "⚠️  Expected 402, got $HTTP_CODE"
  if [ "$HTTP_CODE" == "200" ]; then
    echo "   Session is already cached — skipping payment flow."
    echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f'   {i[\"label\"]}: {i[\"value\"]}') for i in d.get('data',{}).get('insights',[])]" 2>/dev/null || true
  fi
  exit 0
fi

# Step 3: POST with intent:pay
echo "=== Step 3: POST /api/premium-data with intent:pay ==="
PAY_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/api/premium-data" \
  -H 'Content-Type: application/json' \
  -H "X-Caller-Identity: $IDENTITY" \
  -d '{"intent":"pay"}' 2>&1)
PAY_CODE=$(echo "$PAY_RESPONSE" | grep 'HTTP_CODE:' | sed 's/.*HTTP_CODE://')
PAY_BODY=$(echo "$PAY_RESPONSE" | grep -v 'HTTP_CODE:')
echo "HTTP $PAY_CODE"
echo "$PAY_BODY" | python3 -m json.tool 2>/dev/null || echo "(raw) $PAY_BODY"
echo ""

# Extract orderId from payment object
ORDER_ID=$(echo "$PAY_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('payment',{}).get('orderId',''))" 2>/dev/null || echo "")
if [ -z "$ORDER_ID" ]; then
  ORDER_ID=$(echo "$PAY_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('orderId',''))" 2>/dev/null || echo "")
fi
echo "Order ID: $ORDER_ID"
echo ""

# Step 4: POST with orderId to confirm
echo "=== Step 4: POST /api/premium-data with orderId ==="
CONFIRM_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/api/premium-data" \
  -H 'Content-Type: application/json' \
  -H "X-Caller-Identity: $IDENTITY" \
  -d "{\"orderId\":\"$ORDER_ID\"}" 2>&1)
CONFIRM_CODE=$(echo "$CONFIRM_RESPONSE" | grep 'HTTP_CODE:' | sed 's/.*HTTP_CODE://')
CONFIRM_BODY=$(echo "$CONFIRM_RESPONSE" | grep -v 'HTTP_CODE:')
echo "HTTP $CONFIRM_CODE"
echo "$CONFIRM_BODY" | python3 -m json.tool 2>/dev/null || echo "(raw) $CONFIRM_BODY"
echo ""

# Step 5: GET again (should return data now)
echo "=== Step 5: GET /api/premium-data (expect 200 with data) ==="
FINAL_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -H "X-Caller-Identity: $IDENTITY" "$BASE_URL/api/premium-data" 2>&1)
FINAL_CODE=$(echo "$FINAL_RESPONSE" | grep 'HTTP_CODE:' | sed 's/.*HTTP_CODE://')
FINAL_BODY=$(echo "$FINAL_RESPONSE" | grep -v 'HTTP_CODE:')
echo "HTTP $FINAL_CODE"
echo "$FINAL_BODY" | python3 -m json.tool 2>/dev/null || echo "(raw) $FINAL_BODY"
echo ""

# Summary
echo "╔══════════════════════════════════════════════════════╗"
echo "║                  Test Results                       ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Step 1: Health Check          $(echo "$HEALTH_CODE" | grep -q '200' && echo 'PASS' || echo 'FAIL')"
echo "║  Step 2: GET (expect 402)      $(echo "$HTTP_CODE" | grep -q '402' && echo 'PASS' || echo 'FAIL')"
echo "║  Step 3: POST intent:pay       $(echo "$PAY_CODE" | grep -qE '402|200' && echo 'PASS' || echo 'FAIL')"
echo "║  Step 4: POST orderId          $(echo "$CONFIRM_CODE" | grep -q '200' && echo 'PASS' || echo 'FAIL')"
echo "║  Step 5: GET (expect data)     $(echo "$FINAL_CODE" | grep -q '200' && echo 'PASS' || echo 'FAIL')"
echo "╚══════════════════════════════════════════════════════╝"
