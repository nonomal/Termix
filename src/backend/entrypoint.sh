#!/bin/sh

# Start the backend server
node /src/backend/server.cjs &

# Start nginx in the foreground
exec nginx -g 'daemon off;'