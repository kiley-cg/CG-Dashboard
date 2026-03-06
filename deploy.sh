#!/bin/bash
set -e

# ── Config ────────────────────────────────────────────────────────────────────
SERVICE_NAME="cg-dashboard"
REGION="us-central1"
ENV_FILE=".env.local"

# ── Load .env.local ───────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found. Create it before deploying."
  exit 1
fi

get_env() {
  grep -E "^${1}=" "$ENV_FILE" | head -1 | cut -d '=' -f2-
}

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
  echo "Error: No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "Deploying $SERVICE_NAME to Cloud Run ($REGION) in project: $PROJECT_ID"

# ── Enable APIs (idempotent) ──────────────────────────────────────────────────
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  --project="$PROJECT_ID" --quiet

# ── Build env var string from .env.local ──────────────────────────────────────
AUTH_SECRET=$(get_env AUTH_SECRET)
# Generate AUTH_SECRET if not set
if [ -z "$AUTH_SECRET" ]; then
  AUTH_SECRET=$(openssl rand -base64 32)
  echo "AUTH_SECRET=$AUTH_SECRET" >> "$ENV_FILE"
  echo "Generated AUTH_SECRET and saved to $ENV_FILE"
fi

ENV_VARS="AUTH_SECRET=$AUTH_SECRET"

add_var() {
  local key="$1"
  local val
  val=$(get_env "$key")
  if [ -n "$val" ]; then
    ENV_VARS="$ENV_VARS,$key=$val"
  fi
}

add_var GOOGLE_CLIENT_ID
add_var GOOGLE_CLIENT_SECRET
add_var ALLOWED_DOMAIN
add_var FIREBASE_PROJECT_ID
add_var FIREBASE_CLIENT_EMAIL
add_var ANTHROPIC_API_KEY
add_var SYNCORE_API_KEY
add_var SS_API_KEY
add_var SS_API_BASE_URL
add_var SANMAR_WSDL_URL
add_var SANMAR_API_USER
add_var SANMAR_API_PASSWORD

# FIREBASE_PRIVATE_KEY needs special handling (contains newlines)
FIREBASE_PRIVATE_KEY=$(get_env FIREBASE_PRIVATE_KEY)
if [ -n "$FIREBASE_PRIVATE_KEY" ]; then
  ENV_VARS="$ENV_VARS,FIREBASE_PRIVATE_KEY=$FIREBASE_PRIVATE_KEY"
fi

# ── Deploy ────────────────────────────────────────────────────────────────────
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "$ENV_VARS" \
  --project="$PROJECT_ID" \
  --quiet

# ── Print URL and next steps ──────────────────────────────────────────────────
URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project="$PROJECT_ID" \
  --format="value(status.url)")

echo ""
echo "✓ Deployed: $URL"
echo ""
echo "Next steps:"
echo "  1. Set AUTH_URL: gcloud run services update $SERVICE_NAME --region $REGION --update-env-vars AUTH_URL=$URL"
echo "  2. Add to Google OAuth redirect URIs: $URL/api/auth/callback/google"
