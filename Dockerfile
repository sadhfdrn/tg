# 1. Installer Stage: Install dependencies and build the app
FROM node:20-alpine AS installer
WORKDIR /app

# Install system dependencies needed for sharp and ffmpeg
RUN apk add --no-cache vips-dev build-base python3 make g++ ffmpeg

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the Next.js application
RUN npm run build

# 2. Runner Stage: Create the final, lean production image
FROM node:20-alpine AS runner
WORKDIR /app

# Install only the necessary runtime system dependencies
RUN apk add --no-cache vips ffmpeg

# Set environment variable for Next.js
ENV NODE_ENV=production
# Uncomment the following line in case of server-side rendering issues
# ENV NEXT_TELEMETRY_DISABLED 1

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
# Copy the standalone output from the installer stage.
COPY --from=installer /app/.next/standalone ./
# Copy the static assets from the installer stage.
COPY --from=installer /app/.next/static ./.next/static

# Expose the port Next.js runs on
EXPOSE 3000

# Set the user to a non-root user for security
# USER node

# Define the command to run the application
CMD ["node", "server.js"]
