FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source (includes UNO-FLIP/ code)
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/app.js"]


