#!/bin/sh
set -e

export PORT=${PORT:-8080}
echo "Configuring web UI to run on port: $PORT"

# Configure nginx with the correct port
envsubst '${PORT}' < /etc/nginx/nginx.conf > /etc/nginx/nginx.conf.tmp
mv /etc/nginx/nginx.conf.tmp /etc/nginx/nginx.conf

# Setup data directory
mkdir -p /app/data
chown -R node:node /app/data
chmod 755 /app/data

echo "Starting nginx..."
nginx

# Start backend services
echo "Starting backend services..."
cd /app
export NODE_ENV=production

# Start the compiled TypeScript backend
if command -v su-exec > /dev/null 2>&1; then
  su-exec node node dist/backend/starter.js
else
  su -s /bin/sh node -c "node dist/backend/starter.js"
fi

echo "All services started"

# Keep container running
tail -f /dev/null