# Build stage for the backend
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install pm2 globally
RUN npm install -g pm2

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY ecosystem.config.cjs ./

EXPOSE 3001
CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
