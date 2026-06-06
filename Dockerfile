# Build stage
FROM node:20-alpine AS build
WORKDIR /app
# Empty default → the SPA calls /api/... (same origin); nginx proxies to the
# api container. Override with --build-arg VITE_API_BASE_URL=http://... if
# you want the SPA to call a separate API host directly.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build

# Runtime stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
