# Build the frontend assets
FROM node:20-alpine AS builder
WORKDIR /app

# Ensure dev dependencies like Vite are installed even if NODE_ENV is set to production
ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

# Serve the compiled frontend through nginx
FROM nginx:1.27-alpine

ENV NODE_ENV=production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
