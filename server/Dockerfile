# Build stage for the backend
FROM node:20-alpine AS builder
WORKDIR /app

# Respect proxy and CA settings during dependency installation to support
# restricted networks.
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG NODE_EXTRA_CA_CERTS
ENV HTTP_PROXY=${HTTP_PROXY} \
    HTTPS_PROXY=${HTTPS_PROXY} \
    NO_PROXY=${NO_PROXY} \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS}

COPY package*.json ./
# Use npm ci with the lockfile to ensure repeatable installs and allow dev
# dependencies needed for TypeScript builds.
RUN npm ci --include=dev --legacy-peer-deps --omit=optional

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Carry proxy/CA settings into the runtime install so production dependencies
# can also be fetched behind proxies.
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG NODE_EXTRA_CA_CERTS
ENV HTTP_PROXY=${HTTP_PROXY} \
    HTTPS_PROXY=${HTTPS_PROXY} \
    NO_PROXY=${NO_PROXY} \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS}

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps --omit=optional

COPY --from=builder /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/index.js"]
