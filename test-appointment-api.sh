#!/bin/bash

# Test script for POST /api/appointments endpoint
# Tests validation, successful booking, and double-booking prevention

BASE_URL="http://localhost:3000"
BUSINESS_ID="866a6183-f982-4e24-93ab-fcf8165574c5"  # Your test business

echo "==================================="
echo "Testing Appointments API"
echo "==================================="
echo ""

# Test 1: Validation Error - Missing Required Fields
echo "Test 1: Validation Error (Missing Fields)"
echo "-----------------------------------"
curl -X POST "${BASE_URL}/api/appointments" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "'${BUSINESS_ID}'"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

# Test 2: Validation Error - Invalid Email
echo "Test 2: Validation Error (Invalid Email)"
echo "-----------------------------------"
curl -X POST "${BASE_URL}/api/appointments" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "'${BUSINESS_ID}'",
    "start_time": "2025-12-01T14:00:00Z",
    "end_time": "2025-12-01T15:00:00Z",
    "duration_minutes": 60,
    "customer_email": "not-an-email",
    "customer_name": "John Doe"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

# Test 3: Validation Error - Past Booking
echo "Test 3: Validation Error (Past Date)"
echo "-----------------------------------"
curl -X POST "${BASE_URL}/api/appointments" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "'${BUSINESS_ID}'",
    "start_time": "2020-01-01T14:00:00Z",
    "end_time": "2020-01-01T15:00:00Z",
    "duration_minutes": 60,
    "customer_email": "test@example.com",
    "customer_name": "John Doe"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

# Test 4: Successful Booking
echo "Test 4: Successful Booking"
echo "-----------------------------------"
RANDOM_MINUTE=$((RANDOM % 60))
FUTURE_DATE="2025-12-15T$(printf "%02d" $((10 + RANDOM % 8))):${RANDOM_MINUTE}:00Z"
FUTURE_DATE_END="2025-12-15T$(printf "%02d" $((11 + RANDOM % 8))):${RANDOM_MINUTE}:00Z"

BOOKING_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/appointments" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "'${BUSINESS_ID}'",
    "start_time": "'${FUTURE_DATE}'",
    "end_time": "'${FUTURE_DATE_END}'",
    "duration_minutes": 60,
    "customer_email": "test@example.com",
    "customer_name": "John Doe",
    "customer_phone": "+1234567890",
    "notes": "Test appointment"
  }')

echo "$BOOKING_RESPONSE" | jq '.'
echo ""

# Extract booking token
BOOKING_TOKEN=$(echo "$BOOKING_RESPONSE" | jq -r '.data.booking_token // empty')

if [ ! -z "$BOOKING_TOKEN" ]; then
  echo "✅ Booking successful! Token: $BOOKING_TOKEN"
  echo ""
  
  # Test 5: Double-Booking Prevention (Race Condition Test)
  echo "Test 5: Double-Booking Prevention"
  echo "-----------------------------------"
  echo "Attempting to book the same time slot..."
  curl -X POST "${BASE_URL}/api/appointments" \
    -H "Content-Type: application/json" \
    -d '{
      "business_id": "'${BUSINESS_ID}'",
      "start_time": "'${FUTURE_DATE}'",
      "end_time": "'${FUTURE_DATE_END}'",
      "duration_minutes": 60,
      "customer_email": "another@example.com",
      "customer_name": "Jane Smith"
    }' \
    -w "\nHTTP Status: %{http_code} (Expected: 409 Conflict)\n\n"
else
  echo "❌ Booking failed"
fi

echo "==================================="
echo "Tests Complete"
echo "==================================="

