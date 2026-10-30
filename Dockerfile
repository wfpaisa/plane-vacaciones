# Vacaciones: la web compilada y PocketBase en una sola imagen Alpine.

FROM oven/bun:1-alpine AS web
WORKDIR /src
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY tsconfig.json ./
COPY web ./web
RUN bunx --bun vite build --config web/vite.config.ts && rm -f web/dist/assets/*.map

FROM alpine:3.22 AS pocketbase
ARG PB_VERSION=0.39.11
ARG TARGETARCH=amd64
WORKDIR /tmp/pb
RUN apk add --no-cache unzip \
 && base="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}" \
 && file="pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
 && wget -q "$base/$file" "$base/checksums.txt" \
 && grep " $file\$" checksums.txt | sha256sum -c - \
 && unzip -q "$file" pocketbase

FROM alpine:3.22
# uid/gid 1000, el mismo de vigotes en el servidor: la carpeta pb_data es suya.
RUN apk add --no-cache ca-certificates tzdata \
 && addgroup -S -g 1000 vacaciones && adduser -S -u 1000 -G vacaciones -h /app vacaciones \
 && mkdir -p /data && chown vacaciones:vacaciones /data
WORKDIR /app
COPY --from=pocketbase /tmp/pb/pocketbase /usr/local/bin/pocketbase
COPY pb/pb_migrations ./pb_migrations
COPY pb/pb_hooks ./pb_hooks
COPY --from=web /src/web/dist ./pb_public
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

USER vacaciones
VOLUME /data
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null || exit 1
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
