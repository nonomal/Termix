# Use Node.js base image for building frontend
FROM --platform=$BUILDPLATFORM node:18-alpine AS builder

# Install dependencies
RUN apk add --no-cache npm
WORKDIR /app
COPY package*.json ./
RUN npm install

# Copy project files and build frontend
COPY ./ ./
RUN npm run build

# Final stage with nginx
FROM --platform=$TARGETPLATFORM nginx:alpine

# Copy built frontend from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Expose necessary ports
EXPOSE 8080
EXPOSE 8081

# Use entrypoint.sh to start backend and nginx
COPY --from=builder /app/src/backend/entrypoint.sh /app/src/backend/entrypoint.sh
RUN chmod +x /app/src/backend/entrypoint.sh
ENTRYPOINT ["/app/src/backend/entrypoint.sh"]