
# Stage 1: Install dependencies and build the application
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies needed for Sharp and FFmpeg
# We install build dependencies here, but not in the final image
RUN apk add --no-cache libc6-compat build-base python3 make g++ ffmpeg vips-dev

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Next.js application
# This will also trigger asset copying if configured in next.config.js
RUN npm run build

# Stage 2: Create the final, lean production image
FROM node:20-alpine AS runner

# Set working directory
WORKDIR /app

# Install runtime dependencies for Sharp and FFmpeg
# We only install what's needed to RUN the app, not build it.
RUN apk add --no-cache ffmpeg vips

# Set environment variables for Next.js
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy the assets from the builder stage to the final image
# This ensures our watermark SVGs are available in production
COPY --from=builder /app/.next/server/app/assets ./app/assets

CMD ["node", "server.js"]
