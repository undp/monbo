#!/bin/sh
set -e

# Colors
BLUE="\033[34m"       # API messages
GREEN="\033[32m"      # Frontend messages
RED="\033[31m"        # Errors
CYAN="\033[36m"       # Info messages
RESET="\033[0m"

echo "${CYAN}Checking required runtime environment variables...${RESET}"
if [ -z "$API_URL" ]; then
    echo "${RED}Error: API_URL is not set${RESET}"
    exit 1
fi

if [ -z "$GOOGLE_SERVICE_API_KEY" ]; then
    echo "${RED}Error: GOOGLE_SERVICE_API_KEY is not set${RESET}"
    exit 1
fi
echo "${CYAN}✓ All required runtime environment variables are set${RESET}"

echo "${CYAN}Replacing environment variables in frontend's built files...${RESET}"
if [ -n "$API_URL" ]; then
    find /app/frontend/.next/static -type f -name '*.js' -exec sed -i "s|__API_URL__|$API_URL|g" {} +
fi

if [ -n "$GOOGLE_SERVICE_API_KEY" ]; then
    find /app/frontend/.next/static -type f -name '*.js' -exec sed -i "s|__GOOGLE_SERVICE_API_KEY__|$GOOGLE_SERVICE_API_KEY|g" {} +
fi
echo "${CYAN}✓ Environment variables replacement completed${RESET}"

# Trap signals for graceful shutdown
trap 'echo "${CYAN}Received shutdown signal...${RESET}"; kill $(jobs -p); echo "${CYAN}✓ Graceful shutdown completed${RESET}"' SIGTERM SIGINT

# Start services
echo "${CYAN}Starting services...${RESET}"
echo "${CYAN}► Starting FastAPI backend...${RESET}"
cd /app/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 2>&1 | stdbuf -oL sed "s/^/${BLUE}[API]${RESET} /" &

echo "${CYAN}► Starting Next.js frontend...${RESET}"
cd /app/frontend
HOSTNAME="0.0.0.0" node server.js 2>&1 | stdbuf -oL sed "s/^/${GREEN}[FRONT]${RESET} /" &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
echo "${RED}One of the processes exited unexpectedly${RESET}"
exit $?