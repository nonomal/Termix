#!/bin/sh

# Start NGINX in background
nginx -g "daemon off;" &

# Start Node.js backend
node src/backend/index.js

# Keep container running
wait