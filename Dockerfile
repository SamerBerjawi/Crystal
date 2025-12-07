# Build the frontend assets
FROM node:20-alpine AS builder
WORKDIR /app

# Always install dev dependencies regardless of NODE_ENV to ensure Vite is available
ENV NPM_CONFIG_PRODUCTION=false

COPY package*.json ./
RUN npm ci --include=dev --legacy-peer-deps --omit=optional

COPY . .
RUN npm run build

# Serve the compiled frontend through nginx
FROM nginx:1.27-alpine

ENV NODE_ENV=production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
