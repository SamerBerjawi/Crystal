# Build stage for the backend
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --no-scripts

COPY . .
RUN npm run build

# Production image
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install pm2 globally
RUN npm install -g pm2

COPY package*.json ./
RUN npm install --omit=dev --no-scripts

COPY --from=builder /app/dist ./dist
COPY ecosystem.config.cjs ./

EXPOSE 3001
CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
