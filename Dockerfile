# syntax=docker/dockerfile:1

# ---- deps: full install (also used by the one-shot `migrate` service) --------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ------------------------------------------------------------------
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- migrate: runs `npm run db:migrate` against DATABASE_URL, then exits -------
FROM deps AS migrate
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY tsconfig.json ./
CMD ["npm", "run", "db:migrate"]

# ---- runtime: minimal standalone server -----------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/data/uploads

RUN addgroup -S app && adduser -S app -G app \
 && mkdir -p /data/uploads && chown -R app:app /data

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

USER app
VOLUME ["/data/uploads"]
EXPOSE 3000
CMD ["node", "server.js"]
