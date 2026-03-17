#!/usr/bin/env bash
# =============================================================================
# create-secrets.sh — Create all Secret Manager secrets for CG-Dashboard
#
# Run this on your Mac AFTER:
#   1. gcloud auth login
#   2. gcloud config set project YOUR_FIREBASE_PROJECT_ID
#
# Usage: bash scripts/create-secrets.sh
# =============================================================================
set -e

# ── Paste your values here ───────────────────────────────────────────────────

ANTHROPIC_API_KEY=""
SYNCORE_API_KEY=""

FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
# Paste the FULL private key including -----BEGIN/END----- lines.
# Use single quotes to avoid shell escaping issues.
FIREBASE_PRIVATE_KEY=''

SANMAR_API_USER=""
SANMAR_API_PASSWORD=""

SS_API_KEY=""

# Random string — generate with: openssl rand -base64 32
AUTH_SECRET=""

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Any strong random string — generate with: openssl rand -hex 32
EXTENSION_API_KEY=""

# ─────────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

check_var() {
  if [ -z "${!1}" ]; then
    echo -e "${RED}✗ $1 is empty — fill it in at the top of this script${NC}"
    MISSING=1
  fi
}

echo "Checking values..."
MISSING=0
check_var ANTHROPIC_API_KEY
check_var SYNCORE_API_KEY
check_var FIREBASE_PROJECT_ID
check_var FIREBASE_CLIENT_EMAIL
check_var FIREBASE_PRIVATE_KEY
check_var SANMAR_API_USER
check_var SANMAR_API_PASSWORD
check_var SS_API_KEY
check_var AUTH_SECRET
check_var GOOGLE_CLIENT_ID
check_var GOOGLE_CLIENT_SECRET
check_var EXTENSION_API_KEY

if [ "$MISSING" = "1" ]; then
  echo -e "\n${YELLOW}Fill in the missing values above and re-run.${NC}"
  exit 1
fi

PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT" ]; then
  echo -e "${RED}No gcloud project set. Run: gcloud config set project YOUR_PROJECT_ID${NC}"
  exit 1
fi
echo -e "${GREEN}Using project: $PROJECT${NC}\n"

create_or_update() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "$name" --project="$PROJECT" &>/dev/null; then
    echo -n "  Updating $name ... "
    echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT" > /dev/null
  else
    echo -n "  Creating $name ... "
    echo -n "$value" | gcloud secrets create "$name" --data-file=- --project="$PROJECT" \
      --replication-policy=automatic > /dev/null
  fi
  echo -e "${GREEN}done${NC}"
}

echo "Creating/updating secrets in Secret Manager..."
create_or_update "anthropic-api-key"      "$ANTHROPIC_API_KEY"
create_or_update "syncore-api-key"        "$SYNCORE_API_KEY"
create_or_update "firebase-project-id"   "$FIREBASE_PROJECT_ID"
create_or_update "firebase-client-email" "$FIREBASE_CLIENT_EMAIL"
create_or_update "firebase-private-key"  "$FIREBASE_PRIVATE_KEY"
create_or_update "sanmar-api-user"        "$SANMAR_API_USER"
create_or_update "sanmar-api-password"    "$SANMAR_API_PASSWORD"
create_or_update "ss-api-key"             "$SS_API_KEY"
create_or_update "auth-secret"            "$AUTH_SECRET"
create_or_update "google-client-id"       "$GOOGLE_CLIENT_ID"
create_or_update "google-client-secret"   "$GOOGLE_CLIENT_SECRET"
create_or_update "extension-api-key"      "$EXTENSION_API_KEY"

echo ""
echo -e "${GREEN}✓ All secrets created successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Grant App Hosting service account access to these secrets:"
echo "     Firebase Console → App Hosting → your backend → Environment Variables"
echo "     (Firebase does this automatically when you link apphosting.yaml)"
echo ""
echo "  2. Update NEXTAUTH_URL in apphosting.yaml with your App Hosting URL"
echo "  3. Add the URL to Google OAuth authorized redirect URIs:"
echo "     https://YOUR_URL/api/auth/callback/google"
