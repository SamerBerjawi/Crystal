# Stage 1: Build the app
FROM node:20-bullseye AS builder
WORKDIR /app

# Copy only package files first (for better caching)
COPY package*.json ./

# Use npm install instead of npm ci for broader compatibility
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the Vite app
RUN npm run build


# Stage 2: Serve the app
FROM node:20-alpine
WORKDIR /app

# Install a lightweight static file server
RUN npm install -g serve

# Copy the build output from the builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 4173

# Serve the built app
CMD ["serve", "-s", "dist", "-l", "4173"]
