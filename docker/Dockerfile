# Build frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY ./ ./
RUN npm run build

# Build backend
FROM node:18-alpine AS backend-build
WORKDIR src/backend
COPY ./ ./

# Configure nginx
FROM nginx:alpine

RUN apk add --no-cache nodejs npm
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY --from=backend-build src/backend /src/backend
COPY --from=backend-build src/backend/entrypoint.sh /src/backend/entrypoint.sh

# Configure start-up
RUN chmod +x src/backend/entrypoint.sh
ENTRYPOINT ["src/backend/entrypoint.sh"]

EXPOSE 8080
EXPOSE 8081