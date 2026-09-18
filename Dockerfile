FROM node:16.13.0-buster-slim

RUN apt-get update && apt-get install -y \
      libcurl4-openssl-dev \
      ca-certificates \
      build-essential \
      python \
      python3

COPY ./ /usr/src
WORKDIR /usr/src
RUN npm ci
RUN npm run generate

# The bot is now a single interactive process (TUI) instead of an HTTP server:
# run this container with `-it` (and `-d` if you want to `docker attach` later),
# there is no port to publish anymore.
CMD ["./node_modules/.bin/ts-node", "./index.ts"]
