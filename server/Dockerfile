# Build stage for the backend
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder
WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

# Production image
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Tax documents and other server files live under /app/config. Create it for the unprivileged user so a volume mounted
# there (a named one, or a folder that already belongs to uid 1000) is writable.
RUN mkdir -p /app/config && chown node:node /app/config

EXPOSE 3001
# Run as the unprivileged user that ships with the node image.
USER node
CMD ["node", "dist/index.js"]

