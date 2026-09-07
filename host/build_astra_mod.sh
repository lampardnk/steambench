#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT/.runtime/sts2mcp/src"
BUILD="$ROOT/.runtime/sts2mcp/astra-src"
OUTPUT="$ROOT/.runtime/sts2mcp/astra-out"
GAME="${STS2_GAME_DIR:-$HOME/.local/share/Steam/steamapps/common/Slay the Spire 2}"
[[ -f "$SOURCE/STS2_MCP.csproj" ]] || { echo 'Build the base mod first: host/install_sts2mcp.sh build' >&2; exit 1; }
mkdir -p "$BUILD" "$OUTPUT"
cp "$SOURCE"/*.cs "$SOURCE/STS2_MCP.csproj" "$BUILD/"
cp "$ROOT/host/astra/McpMod.Steambench.cs" "$BUILD/"
DOCKER_CONTEXT=default docker run --rm --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e DOTNET_CLI_HOME=/tmp -e DOTNET_CLI_TELEMETRY_OPTOUT=1 \
  -v "$BUILD:/src" -v "$OUTPUT:/out" -v "$GAME:/game:ro" -w /src \
  mcr.microsoft.com/dotnet/sdk:9.0 \
  dotnet build STS2_MCP.csproj -c Release -o /out -p:STS2GameDir=/game
cp "$SOURCE/mod_manifest.json" "$OUTPUT/STS2_MCP.json"
sha256sum "$OUTPUT/STS2_MCP.dll"
