FROM node:lts-alpine

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
ADD package-lock.json .

RUN npm ci

ADD tsconfig.json .
ADD src src

RUN npm run clean-compile

ENV GIT_COMMIT "{{ git_commit }}"
ENV GIT_BRANCH "{{ git_branch }}"
ENV BUILD_TIMESTAMP "{{ build_timestamp }}"

ENTRYPOINT ["npm", "run"]

CMD ["execute"]