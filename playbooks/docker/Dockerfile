FROM node:alpine

RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /opt/app

ADD package.json .
ADD yarn.lock .

RUN yarn install

ADD tsconfig.json .
ADD src src

RUN yarn clean && yarn compile

ENV GIT_COMMIT "{{ git_commit }}"
ENV GIT_BRANCH "{{ git_branch }}"
ENV BUILD_TIMESTAMP "{{ build_timestamp }}"

ENTRYPOINT ["yarn"]

CMD ["execute"]