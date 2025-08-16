# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

RUN bun run build

# copy production dependencies and built artifacts into final image (runtime-only)
FROM base AS release
WORKDIR /usr/src/app

# copy production node_modules and runtime assets only, set ownership to bun during copy
COPY --from=install --chown=bun:bun /temp/prod/node_modules ./node_modules
COPY --from=prerelease --chown=bun:bun /usr/src/app/package.json ./
COPY --from=prerelease --chown=bun:bun /usr/src/app/dist ./dist
COPY --from=prerelease --chown=bun:bun /usr/src/app/dev-wallet.json ./
COPY --from=prerelease --chown=bun:bun /usr/src/app/data/ ./data/

# ensure runtime writable log file exists and the app dir is owned by bun
RUN mkdir -p /usr/src/app && touch /usr/src/app/logs && chown bun:bun /usr/src/app/logs && chown -R bun:bun /usr/src/app

USER bun

EXPOSE 3000/tcp
CMD ["bun", "dist/server.js"]