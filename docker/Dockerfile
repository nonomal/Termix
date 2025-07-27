# Stage 1: Install dependencies and build frontend
FROM node:18-alpine AS deps
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies with caching
RUN npm ci --force && \
    npm cache clean --force

# Stage 2: Build frontend
FROM deps AS frontend-builder
WORKDIR /app

# Copy source files
COPY . .

# Build frontend
RUN npm run build

# Stage 3: Build backend TypeScript
FROM deps AS backend-builder
WORKDIR /app

# Copy source files
COPY . .

# Build backend TypeScript to JavaScript
RUN npm run build:backend

# Stage 4: Production dependencies
FROM node:18-alpine AS production-deps
WORKDIR /app

# Copy only production dependency files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --ignore-scripts --force && \
    npm cache clean --force

# Stage 5: Build native modules
FROM node:18-alpine AS native-builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ 

# Copy dependency files
COPY package*.json ./

# Install only the native modules we need
RUN npm ci --only=production bcryptjs better-sqlite3 --force && \
    npm cache clean --force

# Stage 6: Final image
FROM node:18-alpine
ENV DATA_DIR=/app/data \
    PORT=8080 \
    NODE_ENV=production

# Install dependencies in a single layer
RUN apk add --no-cache nginx gettext su-exec && \
    mkdir -p /app/data && \
    chown -R node:node /app/data

# Setup nginx and frontend
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html

# Setup backend
WORKDIR /app

# Copy production dependencies and native modules
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=native-builder /app/node_modules/bcryptjs /app/node_modules/bcryptjs
COPY --from=native-builder /app/node_modules/better-sqlite3 /app/node_modules/better-sqlite3

# Copy compiled backend JavaScript
COPY --from=backend-builder /app/dist/backend ./dist/backend

# Copy package.json for scripts
COPY package.json ./

RUN chown -R node:node /app

VOLUME ["/app/data"]

# Expose ports
EXPOSE ${PORT} 8081 8082 8083 8084

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]