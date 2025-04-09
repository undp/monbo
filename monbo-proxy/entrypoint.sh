#!/bin/bash

# Define health check URLs for frontend and api
FRONTEND_HEALTH_URL="http://frontend:3000/api/health"
API_HEALTH_URL="http://api:8000/health"

# Function to check health status
check_health() {
    url=$1
    response=$(curl --silent --write-out "%{http_code}" --output /dev/null "$url")
    if [ "$response" -eq 200 ]; then
        echo "$url is healthy."
    else
        echo "$url is not healthy, retrying..."
        return 1
    fi
    return 0
}

# Wait for both frontend and api to be healthy
until check_health $FRONTEND_HEALTH_URL && check_health $API_HEALTH_URL; do
    echo "Waiting for frontend and API to be healthy..."
    sleep 5
done

# Start Nginx after health checks pass
echo "Frontend and API are healthy, starting NGINX..."
nginx -g "daemon off;"
