# First stage: build the app
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for Sharp and FFmpeg
# Using --no-cache helps to keep the image size down
RUN apk add --no-cache libc6-compat build-base python3 make g++ ffmpeg vips-dev

# Copy package files and install dependencies
# Using npm ci is faster and more reliable for CI/CD environments
COPY package*.json ./
RUN npm ci

# Copy application code
# This includes the src directory with assets
COPY . .

# Build the Next.js app
# The output will be in standalone mode as configured in next.config.ts
RUN npm run build

# Second stage: create the lean production image
FROM node:20-alpine AS runner

WORKDIR /app

# Install only the runtime dependencies needed by the application
# ffmpeg for video processing and vips for sharp
RUN apk add --no-cache ffmpeg vips

# Set user to a non-root user for better security
USER node

# Copy the standalone output from the builder stage
# This includes the server, dependencies, and static assets
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Expose the port the app runs on
EXPOSE 3000

# The command to run the Next.js standalone server
CMD ["node", "server.js"]
