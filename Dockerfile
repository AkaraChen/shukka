FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    SHUKKA_DATA_DIR=/data

# better-sqlite3 ships a native binding, so production deps are installed here too.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/.output ./.output
COPY drizzle ./drizzle

VOLUME ["/data"]
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
