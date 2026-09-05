FROM node:24-bookworm-slim

LABEL org.opencontainers.image.source="https://github.com/earendil-works/pi"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Pi's published coding-agent package is built from the linked repository.
# Pinned so the extension API stays stable; bump deliberately.
RUN npm install --global --ignore-scripts @earendil-works/pi-coding-agent@0.85.0

# Container-side code: the gateway client, the manual CLI, the Pi extension
# that exposes STS2 sensors and the virtual pad, and the agent playbook.
# Everything talks to the host through the allowlisted process gateway; the
# container never receives the host PID namespace, display, or input devices.
COPY client/ /opt/steambench/
COPY client/steambench-pi /usr/local/bin/steambench-pi
# Built-in tools are limited to the file tools the skill folder needs (read the
# skill, take notes in scratchpad/); no shell, no web. Extension tools stay on.
RUN chmod 0755 /opt/steambench/process_connect.js /usr/local/bin/steambench-pi \
    && ln -s /opt/steambench/process_connect.js /usr/local/bin/steambench-host \
    && mkdir -p /run/steambench /home/node/.pi/agent /workspace/skills \
    && printf '{ "defaultTools": ["read", "write", "edit", "ls", "grep", "find"] }\n' > /home/node/.pi/agent/settings.json \
    && chown -R node:node /run/steambench /home/node/.pi /workspace

WORKDIR /workspace
USER node

# The host gateway must be started on loopback TCP port 28771.
ENV STEAMBENCH_PROCESS_GATEWAY=host.docker.internal:28771
ENV STEAMBENCH_MODEL=nvidia/nemotron-3-super-120b-a12b:free
ENV STEAMBENCH_VISION_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
ENV STEAMBENCH_SKILLS_DIR=/workspace/skills
# steambench-pi runs Pi with the STS2 extension, file tools only, and every
# skill mounted under /workspace/skills; extra arguments are passed to Pi.
# With STEAMBENCH_PLAYER_MODE=rpc and no arguments it speaks Pi's JSONL RPC.
ENTRYPOINT ["steambench-pi"]
CMD []
