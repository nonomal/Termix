# Build frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY ./ ./
RUN npm run build

# Build backend and configure nginx
FROM node:18-alpine AS build
WORKDIR /app

# Copy backend code
COPY ./src/backend /app/src/backend

# Install nginx, nodejs, and npm
RUN apk add --no-cache nginx nodejs npm

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy the built frontend files
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Copy the backend files
COPY --from=build /app/src/backend /src/backend
COPY --from=build /app/src/backend/entrypoint.sh /src/backend/entrypoint.sh

# Set up start-up
RUN chmod +x /src/backend/entrypoint.sh

# Expose necessary ports
EXPOSE 8080
EXPOSE 8081

# Use entrypoint.sh to run both the backend and nginx
ENTRYPOINT ["/src/backend/entrypoint.sh"]