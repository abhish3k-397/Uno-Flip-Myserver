FROM node:20-alpine AS builder

WORKDIR /app

# Install full deps for build (includes devDependencies like esbuild)
# Use npm install to handle lockfile mismatches gracefully
COPY package*.json ./
RUN npm install

# Copy source and build bundled assets
COPY . .
RUN npm run build:assets

FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code and built assets from builder
COPY --from=builder /app/server /app/server
COPY --from=builder /app/public /app/public

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/app.js"]


