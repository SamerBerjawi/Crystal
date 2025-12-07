# Build the frontend assets
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
# Always install dev dependencies so build tooling like Vite is available even if
# NODE_ENV is set to "production" during the build.
RUN npm install --include=dev

COPY . .
RUN npm run build

# Serve the compiled frontend through nginx
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
