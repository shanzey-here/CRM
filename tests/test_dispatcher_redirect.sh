#!/bin/bash

# Test: Dispatcher redirect from /office/settings/staff
# This test verifies that a dispatcher user trying to access /office/settings/staff
# gets redirected (403 or redirect response) and cannot access the page

SUPABASE_URL="$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2-)"
ANON_KEY="$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2-)"
API_URL="http://localhost:3000"

echo "=========================================="
echo "Test 4: Dispatcher Redirect from Staff Page"
echo "=========================================="
echo ""

# Step 1: Sign in dispatcher with Supabase Auth
echo "[1/3] Signing in as dispatcher@devtest.local..."

AUTH_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dispatcher@devtest.local",
    "password": "DevTest123!"
  }')

ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty')

if [ -z "$ACCESS_TOKEN" ]; then
  echo "✗ FAILED: Could not sign in dispatcher"
  echo "Response: $AUTH_RESPONSE"
  exit 1
fi

echo "✓ Dispatcher signed in"
echo "  Access Token: ${ACCESS_TOKEN:0:50}..."
echo ""

# Step 2: Try to access /office/settings/staff
echo "[2/3] Attempting to access /office/settings/staff..."

STAFF_RESPONSE=$(curl -s -w "\n%{http_code}" -L --max-redirs 0 \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "${API_URL}/office/settings/staff")

# Extract status code (last line)
HTTP_STATUS=$(echo "$STAFF_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$STAFF_RESPONSE" | sed '$d')

echo "  HTTP Status: $HTTP_STATUS"
echo ""

# Step 3: Analyze response
echo "[3/3] Verifying redirect behavior..."
echo ""

# Check if we got a redirect (3xx status) or a 401/403
if [[ "$HTTP_STATUS" =~ ^30[1278]$ ]]; then
  echo "✓ PASS: Got redirect response (HTTP $HTTP_STATUS)"
  echo ""
  echo "Evidence:"
  echo "  Request: GET /office/settings/staff"
  echo "  User: dispatcher@devtest.local (role: dispatcher)"
  echo "  Response: HTTP $HTTP_STATUS"
  echo ""

  # Show where it redirected (if available in headers)
  LOCATION=$(echo "$RESPONSE_BODY" | grep -i "^Location:" | cut -d' ' -f2- | tr -d '\r')
  if [ ! -z "$LOCATION" ]; then
    echo "  Redirects to: $LOCATION"
  fi
else
  echo "✗ FAIL: Expected redirect (3xx), got HTTP $HTTP_STATUS"
  echo ""
  echo "Response body (first 500 chars):"
  echo "${RESPONSE_BODY:0:500}"
fi
