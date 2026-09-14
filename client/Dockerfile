FROM node:24-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global --ignore-scripts @earendil-works/pi-coding-agent@0.85.0
COPY client/learning/ /opt/steambench/client/learning/
COPY client/gateway_client.js /opt/steambench/client/gateway_client.js
COPY server/lib/gateway-deadlines.cjs /opt/steambench/server/lib/gateway-deadlines.cjs
COPY server/lib/learning-artifact.mjs /opt/steambench/server/lib/learning-artifact.mjs
COPY server/lib/learning-profile.mjs /opt/steambench/server/lib/learning-profile.mjs
COPY server/lib/sts2-actions.js /opt/steambench/server/lib/sts2-actions.js
COPY --chown=node:node client/learning/models.json client/learning/settings.json /home/node/.pi/agent/
RUN mkdir -p /workspace/skills && chown -R node:node /workspace
WORKDIR /workspace
USER node
ENV STEAMBENCH_SKILLS_DIR=/workspace/skills
LABEL org.opencontainers.image.title="STS2-Pi-Luna" \
      ai.steambench.model="gpt-5.6-luna"
ENTRYPOINT ["node", "/opt/steambench/client/learning/player.mjs"]
CMD []
