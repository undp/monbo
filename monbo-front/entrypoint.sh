#!/bin/sh
set -e

echo "Checking required runtime environment variables..."
if [ -z "$NEXT_PUBLIC_API_URL" ]; then
    echo "Error: NEXT_PUBLIC_API_URL is not set"
    exit 1
fi

if [ -z "$NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY" ]; then
    echo "Error: NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY is not set"
    exit 1
fi
echo "✓ All required runtime environment variables are set"

echo "Replacing environment variables in frontend's built files..."
find /app/.next/static -type f -name '*.js' -exec sed -i "s|__NEXT_PUBLIC_API_URL__|$NEXT_PUBLIC_API_URL|g" {} +
find /app/.next/static -type f -name '*.js' -exec sed -i "s|__NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY__|$NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY|g" {} +
find /app/.next/static -type f -name '*.js' -exec sed -i "s|__NEXT_PUBLIC_OVERLAP_THRESHOLD_PERCENTAGE__|$NEXT_PUBLIC_OVERLAP_THRESHOLD_PERCENTAGE|g" {} +
find /app/.next/static -type f -name '*.js' -exec sed -i "s|__NEXT_PUBLIC_DEFORESTATION_THRESHOLD_PERCENTAGE__|$NEXT_PUBLIC_DEFORESTATION_THRESHOLD_PERCENTAGE|g" {} +
find /app/.next/static -type f -name '*.js' -exec sed -i "s|__NEXT_PUBLIC_SHOW_TESTING_ENVIRONMENT_WARNING__|$NEXT_PUBLIC_SHOW_TESTING_ENVIRONMENT_WARNING|g" {} +
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