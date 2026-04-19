#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <BASE_URL>"
  echo "Example: $0 https://appdev1final-api.onrender.com"
  exit 1
fi

BASE_URL="${1%/}"
STAMP="$(date +%s)"
USER_EMAIL="smoke.user.${STAMP}@example.com"
USER_PASSWORD="password123"
USER_NAME="Smoke User ${STAMP}"

ORGANIZER_EMAIL="${ORGANIZER_EMAIL:-}"
ORGANIZER_PASSWORD="${ORGANIZER_PASSWORD:-}"

PASS_COUNT=0
FAIL_COUNT=0

print_pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "PASS | $1"
}

print_fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "FAIL | $1"
}

expect_status() {
  local name="$1"
  local expected="$2"
  local status="$3"
  if [[ "$status" == "$expected" ]]; then
    print_pass "$name (status $status)"
    return 0
  fi
  print_fail "$name (expected $expected, got $status)"
  return 1
}

json_get() {
  local field="$1"
  node -e "
let data='';
process.stdin.on('data', c => data += c);
process.stdin.on('end', () => {
  try {
    const obj = JSON.parse(data || '{}');
    const value = obj['$field'];
    if (value === undefined || value === null) {
      process.stdout.write('');
      return;
    }
    process.stdout.write(String(value));
  } catch {
    process.stdout.write('');
  }
});
"
}

request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local auth="${4:-}"
  local tmpfile
  tmpfile="$(mktemp)"

  local status
  if [[ -n "$auth" && -n "$body" ]]; then
    status=$(curl -sS -o "$tmpfile" -w "%{http_code}" -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $auth" \
      -d "$body")
  elif [[ -n "$auth" ]]; then
    status=$(curl -sS -o "$tmpfile" -w "%{http_code}" -X "$method" "$BASE_URL$path" \
      -H "Authorization: Bearer $auth")
  elif [[ -n "$body" ]]; then
    status=$(curl -sS -o "$tmpfile" -w "%{http_code}" -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" \
      -d "$body")
  else
    status=$(curl -sS -o "$tmpfile" -w "%{http_code}" -X "$method" "$BASE_URL$path")
  fi

  echo "$status|$tmpfile"
}

# 1) Health
res="$(request GET /health)"
health_status="${res%%|*}"
health_file="${res##*|}"
expect_status "Health endpoint" 200 "$health_status" || true
rm -f "$health_file"

# 2) Register normal user
register_body="{\"name\":\"$USER_NAME\",\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}"
res="$(request POST /api/auth/register "$register_body")"
reg_status="${res%%|*}"
reg_file="${res##*|}"
expect_status "Register user" 201 "$reg_status" || true
registered_role="$(cat "$reg_file" | json_get role)"
if [[ "$registered_role" == "user" ]]; then
  print_pass "Registration role assignment stays user"
else
  print_fail "Registration role assignment expected user, got ${registered_role:-<empty>}"
fi
rm -f "$reg_file"

# 3) Login user
login_body="{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}"
res="$(request POST /api/auth/login "$login_body")"
login_status="${res%%|*}"
login_file="${res##*|}"
expect_status "Login user" 200 "$login_status" || true
USER_TOKEN="$(cat "$login_file" | json_get token)"
if [[ -n "$USER_TOKEN" ]]; then
  print_pass "User token returned"
else
  print_fail "User token missing"
fi
rm -f "$login_file"

# 4) Auth check
res="$(request GET /api/auth/me "" "$USER_TOKEN")"
auth_me_status="${res%%|*}"
auth_me_file="${res##*|}"
expect_status "Auth me" 200 "$auth_me_status" || true
rm -f "$auth_me_file"

# 5) RBAC check: user cannot access organizer-only users list
res="$(request GET /api/users "" "$USER_TOKEN")"
users_status="${res%%|*}"
users_file="${res##*|}"
expect_status "RBAC deny /api/users for user role" 403 "$users_status" || true
rm -f "$users_file"

# 6) Core endpoint checks as authenticated user
for path in /api/events /api/groups /api/attendance /api/auth/validate; do
  res="$(request GET "$path" "" "$USER_TOKEN")"
  st="${res%%|*}"
  f="${res##*|}"
  if [[ "$path" == "/api/auth/validate" ]]; then
    # validate endpoint is POST
    rm -f "$f"
    res="$(request POST /api/auth/validate "" "$USER_TOKEN")"
    st="${res%%|*}"
    f="${res##*|}"
  fi

  if [[ "$st" == "200" ]]; then
    print_pass "Core endpoint $path"
  else
    print_fail "Core endpoint $path returned $st"
  fi
  rm -f "$f"
done

# 7) Optional organizer checks (requires pre-existing organizer credentials)
if [[ -n "$ORGANIZER_EMAIL" && -n "$ORGANIZER_PASSWORD" ]]; then
  org_login_body="{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
  res="$(request POST /api/auth/login "$org_login_body")"
  org_login_status="${res%%|*}"
  org_login_file="${res##*|}"

  if [[ "$org_login_status" == "200" ]]; then
    ORGANIZER_TOKEN="$(cat "$org_login_file" | json_get token)"
    print_pass "Organizer login"

    res="$(request GET /api/stats/platform "" "$ORGANIZER_TOKEN")"
    st="${res%%|*}"
    f="${res##*|}"
    expect_status "Organizer access /api/stats/platform" 200 "$st" || true
    rm -f "$f"

    res="$(request GET /api/users "" "$ORGANIZER_TOKEN")"
    st="${res%%|*}"
    f="${res##*|}"
    expect_status "Organizer access /api/users" 200 "$st" || true
    rm -f "$f"
  else
    print_fail "Organizer login failed (status $org_login_status); skipping organizer-only checks"
  fi

  rm -f "$org_login_file"
else
  echo "INFO | ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set; skipping organizer success-path checks"
fi

echo
echo "Summary: $PASS_COUNT passed, $FAIL_COUNT failed"
if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi
