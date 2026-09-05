#!/usr/bin/env bash
# Install, check, or remove the STS2MCP mod in the local Slay the Spire 2 install.
#
#   install_sts2mcp.sh build      build the v0.111-compatible fork (PR #132) in a .NET 9 SDK container
#   install_sts2mcp.sh            install: prefer the local build if present, else download release 0.4.0
#   install_sts2mcp.sh --check    gate: mod hello, JSON state with state_type, godot.log clean
#   install_sts2mcp.sh --restore  remove the mod files (and mods/ if this script created it)
#
# The mod binds 127.0.0.1:15526 inside the game. Only the mod DLL and manifest
# are installed; the mod's Python MCP server is not used. Release 0.4.0 does not
# load on game v0.111 (ReflectionTypeLoadException, upstream issue #131), so
# `build` compiles the fix from PR #132 against the local game assemblies.
set -euo pipefail

VERSION="0.4.0"
BASE_URL="https://github.com/Gennadiyev/STS2MCP/releases/download/${VERSION}"
DLL_SHA256="f429e781d1bfc7fb24b20b6d88bda78c40a29ac0da658349eb4d0f861b325810"
JSON_SHA256="ae6fa24cb037406bfbae82aa25b86cb66b7e7080d0b6ef59a0a0a9d1b19510df"

# v0.111 compatibility fix: https://github.com/Gennadiyev/STS2MCP/pull/132
FORK_URL="https://github.com/DarkArcZ/STS2MCP.git"
FORK_COMMIT="199cf59"
SDK_IMAGE="mcr.microsoft.com/dotnet/sdk:9.0"

GAME_DIR="${STS2_GAME_DIR:-$HOME/.local/share/Steam/steamapps/common/Slay the Spire 2}"
MODS_DIR="$GAME_DIR/mods"
PORT="${STEAMBENCH_STS2_PORT:-15526}"
LOG_FILE="$HOME/.local/share/SlayTheSpire2/logs/godot.log"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$REPO_DIR/.runtime/sts2mcp"
STATE_FILE="$RUNTIME_DIR/install.state"
SRC_DIR="$RUNTIME_DIR/src"
BUILD_DLL="$SRC_DIR/out/STS2_MCP.dll"
BUILD_JSON="$SRC_DIR/mod_manifest.json"

die() { echo "install_sts2mcp: $*" >&2; exit 1; }

verify() {
    local file="$1" expected="$2"
    local actual
    actual="$(sha256sum "$file" | cut -d' ' -f1)"
    [[ "$actual" == "$expected" ]] || die "digest mismatch for $file: $actual"
}

do_build() {
    [[ -f "$GAME_DIR/SlayTheSpire2" ]] || die "game not found at $GAME_DIR (set STS2_GAME_DIR)"
    command -v docker >/dev/null || die "docker is required for the containerized .NET build"
    mkdir -p "$RUNTIME_DIR"
    if [[ ! -d "$SRC_DIR/.git" ]]; then
        git clone -q "$FORK_URL" "$SRC_DIR"
    fi
    git -C "$SRC_DIR" fetch -q origin
    git -C "$SRC_DIR" checkout -q "$FORK_COMMIT"
    docker run --rm \
        -v "$SRC_DIR:/src" \
        -v "$GAME_DIR:/game:ro" \
        -w /src \
        -e DOTNET_CLI_TELEMETRY_OPTOUT=1 \
        -e DOTNET_NOLOGO=1 \
        "$SDK_IMAGE" \
        dotnet build STS2_MCP.csproj -c Release -o /src/out -p:STS2GameDir=/game
    [[ -f "$BUILD_DLL" ]] || die "build produced no DLL"
    sha256sum "$BUILD_DLL" | tee "$RUNTIME_DIR/local-build.sha256"
    echo "built $BUILD_DLL from $FORK_URL @ $FORK_COMMIT; run: $0 install"
}

do_install() {
    [[ -f "$GAME_DIR/SlayTheSpire2" ]] || die "game not found at $GAME_DIR (set STS2_GAME_DIR)"
    mkdir -p "$RUNTIME_DIR"
    local dll json source
    if [[ -f "$BUILD_DLL" ]]; then
        dll="$BUILD_DLL"; json="$BUILD_JSON"; source="local-build:$FORK_COMMIT"
        sha256sum -c --quiet "$RUNTIME_DIR/local-build.sha256" || die "local build digest changed; rerun: $0 build"
        echo "installing local build (PR #132 @ $FORK_COMMIT)"
    else
        for name in STS2_MCP.dll STS2_MCP.json; do
            if [[ ! -f "$RUNTIME_DIR/$name" ]]; then
                echo "downloading $name ${VERSION}"
                curl -fsSL -o "$RUNTIME_DIR/$name" "$BASE_URL/$name"
            fi
        done
        verify "$RUNTIME_DIR/STS2_MCP.dll" "$DLL_SHA256"
        verify "$RUNTIME_DIR/STS2_MCP.json" "$JSON_SHA256"
        dll="$RUNTIME_DIR/STS2_MCP.dll"; json="$RUNTIME_DIR/STS2_MCP.json"; source="release:$VERSION"
        echo "installing release ${VERSION} (note: does not load on game v0.111; use '$0 build' first)"
    fi

    local created_mods_dir="no"
    if [[ ! -d "$MODS_DIR" ]]; then
        mkdir -p "$MODS_DIR"
        created_mods_dir="yes"
    fi
    # Back up only files this script did not install itself, so --restore
    # returns the directory to its pre-steambench state.
    if [[ ! -f "$STATE_FILE" ]]; then
        for name in STS2_MCP.dll STS2_MCP.json STS2_MCP.conf; do
            [[ -e "$MODS_DIR/$name" ]] && cp -a "$MODS_DIR/$name" "$RUNTIME_DIR/$name.backup"
        done
    fi
    cp "$dll" "$MODS_DIR/STS2_MCP.dll"
    cp "$json" "$MODS_DIR/STS2_MCP.json"
    if [[ "$PORT" != "15526" ]]; then
        printf '%s\n' "$PORT" > "$MODS_DIR/STS2_MCP.conf"
    fi
    printf 'created_mods_dir=%s\nversion=%s\nsource=%s\n' "$created_mods_dir" "$VERSION" "$source" > "$STATE_FILE"

    cat <<MSG
installed STS2MCP ($source) into $MODS_DIR

Next, by hand:
  1. Launch Slay the Spire 2 (with the steambench gateway already running).
  2. Settings -> Mods: enable "STS2 MCP". Accept the mod consent dialog if shown.
  3. Restart the game if it asks.
  4. Run: $0 --check
MSG
}

do_check() {
    local hello
    hello="$(curl -fsS -m 3 "http://127.0.0.1:${PORT}/" 2>/dev/null)" || die "mod is not listening on 127.0.0.1:${PORT}; is the game running with the mod enabled?"
    echo "hello: $hello"
    [[ "$hello" =~ v0\.4\.[0-9]+ ]] || die "unexpected mod version in hello (expected v0.4.x)"

    local state
    state="$(curl -fsS -m 5 "http://127.0.0.1:${PORT}/api/v1/singleplayer?format=json")" || die "state endpoint failed"
    printf '%s' "$state" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("state_type:", d.get("state_type")); sys.exit(0 if "state_type" in d else 1)' \
        || die "state JSON has no state_type field; the mod may not match this game version"

    if [[ -f "$LOG_FILE" ]] && grep -iE 'STS2_MCP' "$LOG_FILE" | grep -iqE 'exception|error|failed'; then
        echo "warning: godot.log mentions STS2_MCP errors:" >&2
        grep -iE 'STS2_MCP' "$LOG_FILE" | grep -iE 'exception|error|failed' | tail -n 5 >&2
        exit 1
    fi
    echo "STS2MCP check passed"
}

do_restore() {
    local created_mods_dir="no"
    [[ -f "$STATE_FILE" ]] && created_mods_dir="$(sed -n 's/^created_mods_dir=//p' "$STATE_FILE")"
    for name in STS2_MCP.dll STS2_MCP.json STS2_MCP.conf; do
        if [[ -f "$RUNTIME_DIR/$name.backup" ]]; then
            cp -a "$RUNTIME_DIR/$name.backup" "$MODS_DIR/$name"
            echo "restored previous $name"
        else
            rm -f "$MODS_DIR/$name"
        fi
    done
    if [[ "$created_mods_dir" == "yes" ]] && [[ -d "$MODS_DIR" ]] && [[ -z "$(ls -A "$MODS_DIR")" ]]; then
        rmdir "$MODS_DIR"
    fi
    rm -f "$STATE_FILE"
    echo "STS2MCP removed from $MODS_DIR"
}

case "${1:-install}" in
    install) do_install ;;
    --check) do_check ;;
    --restore) do_restore ;;
    build) do_build ;;
    *) die "usage: $0 [build|install|--check|--restore]" ;;
esac
