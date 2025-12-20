FROM node:lts-alpine as builder

WORKDIR /opt/app

ADD package.json .
ADD package-lock.json .

RUN npm ci

ADD tsconfig.json .
ADD src src

RUN npm run clean-compile

FROM node:lts-alpine

LABEL org.opencontainers.image.source=https://github.com/ruchira088/video-downloader-spa-renderer

RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium-browser

WORKDIR /opt/app

COPY --from=builder /opt/app/build /opt/app/build

ADD package.json .
ADD package-lock.json .

RUN npm ci --omit=dev

ENV GIT_COMMIT "{{ git_commit }}"
ENV GIT_BRANCH "{{ git_branch }}"
ENV BUILD_TIMESTAMP "{{ build_timestamp }}"

ENTRYPOINT ["npm", "run"]

CMD ["execute"]