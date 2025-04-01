#!/bin/sh
set -e

# Colors
BLUE="\033[34m"       # API messages
GREEN="\033[32m"      # Frontend messages
RED="\033[31m"        # Errors
CYAN="\033[36m"       # Info messages
RESET="\033[0m"

# Function to check if a port is available
wait_for_port() {
    local port=$1
    local timeout=30
    echo "${CYAN}Waiting for port ${port}...${RESET}"
    while ! nc -z localhost $port && [ $timeout -gt 0 ]; do
        timeout=$((timeout-1))
        sleep 1
    done
    if [ $timeout -eq 0 ]; then
        echo "${RED}Timeout waiting for port $port${RESET}"
        exit 1
    fi
}

# Environment validation
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

# Start backend
echo "${CYAN}Starting services...${RESET}"
echo "${CYAN}► Starting FastAPI backend...${RESET}"
cd /app/backend
pnpm dev 2>&1 | stdbuf -oL sed "s/^/${BLUE}[API]${RESET} /" &
backend_pid=$!

# Wait for backend to be ready
wait_for_port 8000
echo "${CYAN}✓ Backend is ready${RESET}"

# Start frontend
echo "${CYAN}► Starting Next.js frontend...${RESET}"
cd /app/frontend
pnpm dev 2>&1 | stdbuf -oL sed "s/^/${GREEN}[FRONT]${RESET} /" &
frontend_pid=$!

# Trap signals
trap 'echo "${CYAN}Received shutdown signal...${RESET}"; 
      kill $frontend_pid $backend_pid;
      echo "${CYAN}✓ Graceful shutdown completed${RESET}"' SIGTERM SIGINT

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
echo "${RED}One of the processes exited unexpectedly${RESET}"
exit $?