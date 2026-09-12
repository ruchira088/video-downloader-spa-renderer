FROM node:24-alpine AS builder

RUN apk add --no-cache git

WORKDIR /opt/app

# The build stage only compiles TypeScript, so it has no use for a browser.
ENV PUPPETEER_SKIP_DOWNLOAD="true"

COPY package.json package-lock.json ./

RUN npm ci

COPY tsconfig.json tsconfig.scripts.json ./
COPY src src
COPY config config
COPY scripts scripts
COPY .git .git

RUN npm run clean-compile

FROM node:24-alpine

LABEL org.opencontainers.image.source=https://github.com/ruchira088/video-downloader-spa-renderer

RUN apk add --no-cache \
      tini \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

ENV PUPPETEER_SKIP_DOWNLOAD="true"
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"

WORKDIR /opt/app/build

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY --from=builder --chown=node:node /opt/app/build /opt/app/build

ENV GIT_COMMIT="{{ git_commit }}"
ENV GIT_BRANCH="{{ git_branch }}"

# Chromium still runs with --no-sandbox (the container has no user
# namespaces), but at least not as root.
USER node

ENTRYPOINT ["/sbin/tini", "--", "npm", "run"]

CMD ["execute"]
