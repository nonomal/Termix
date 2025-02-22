# Build everything in one stage
FROM --platform=$BUILDPLATFORM node:18-alpine AS builder

# Install nginx and dependencies
RUN apk add --no-cache nginx npm

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the entire project (frontend and backend)
COPY ./ ./

# Build the frontend
RUN npm run build

# Configure nginx
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy built frontend to nginx's web directory
COPY ./dist /usr/share/nginx/html

# Expose necessary ports
EXPOSE 8080
EXPOSE 8081

# Use entrypoint.sh to run both the backend and nginx
RUN chmod +x /app/src/backend/entrypoint.sh
ENTRYPOINT ["/app/src/backend/entrypoint.sh"]