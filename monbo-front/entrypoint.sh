#!/bin/sh
set -e

echo "Checking required runtime environment variables..."
if [ -z "$API_URL" ]; then
    echo "Error: API_URL is not set"
    exit 1
fi

if [ -z "$GCP_MAPS_PLATFORM_API_KEY" ]; then
    echo "Error: GCP_MAPS_PLATFORM_API_KEY is not set"
    exit 1
fi
echo "✓ All required runtime environment variables are set"

echo "Replacing environment variables in frontend's built files..."
if [ -n "$API_URL" ]; then
    find /app/.next/static -type f -name '*.js' -exec sed -i "s|__API_URL__|$API_URL|g" {} +
fi

if [ -n "$GCP_MAPS_PLATFORM_API_KEY" ]; then
    find /app/.next/static -type f -name '*.js' -exec sed -i "s|GCP_MAPS_PLATFORM_API_KEY|$GCP_MAPS_PLATFORM_API_KEY|g" {} +
fi
echo "✓ Environment variables replacement completed"

# Start service
echo "► Starting Next.js frontend..."
cd /app
HOSTNAME="0.0.0.0" node server.js &

# Wait for all background processes
wait

# Exit with status of process that exited first
echo "The process exited unexpectedly"
exit $?