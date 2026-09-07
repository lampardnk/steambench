FROM node:24-bookworm-slim

# ca-certificates for OpenRouter/GitHub, git for the persistent skill library,
# the static docker CLI to run agent containers and exec helpers in rooms
# through the mounted engine socket.
ARG DOCKER_CLI_VERSION=29.8.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git \
    && curl -fsSL "https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_CLI_VERSION}.tgz" | tar -xz -C /tmp \
    && mv /tmp/docker/docker /usr/local/bin/docker \
    && rm -rf /tmp/docker /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . ./

ENV PORT=8787
EXPOSE 8787 28771
CMD ["node", "bin/server.mjs"]
