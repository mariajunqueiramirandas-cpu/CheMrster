# syntax=docker/dockerfile:1

# 1. Build the app (typecheck + Vite bundle).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2. Only what the server needs at runtime (Clerk's backend SDK and the Postgres driver).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 3. The server: static files from ./dist plus the API, as plain TypeScript run by Node.
FROM node:22-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
CMD ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning", "server/main.ts"]
