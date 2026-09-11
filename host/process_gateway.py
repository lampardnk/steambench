#!/usr/bin/env python3
"""Allowlisted host process gateway for the steambench Pi container.

The gateway deliberately exposes a small JSON-lines API instead of the host
PID namespace or Docker socket. Start it on the host, not in the container.
Run it as the game owner for inspection/logs/input, or as root when ptrace and
process memory access are required.
"""

from __future__ import annotations

import argparse
import base64
import ctypes
import ctypes.util
import json
import os
import pwd
import queue
import re
import signal
import socketserver
import stat
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


MAX_REQUEST = 4 * 1024 * 1024
MAX_MEMORY = 1024 * 1024
MAX_LOG_BYTES = 512 * 1024
SPECIAL_LOG_NAMES = {"console_history.log"}

# STS2MCP mod HTTP API (loopback only). Reads are retried when transient;
# mutations are dispatched exactly once.
STS2MCP_HOST = "127.0.0.1"
STS2MCP_DEFAULT_PORT = 15526
MAX_STS2_BYTES = 1024 * 1024
STS2_GET_ALLOWLIST: dict[str, set[str]] = {
    "/": set(),
    "/api/v1/singleplayer": {"format"},
    "/api/v1/multiplayer": {"format"},
    "/api/v1/profile": {"format"},
    "/api/v1/compendium": {"format"},
    "/api/v1/wiki": {"query", "item_type", "limit", "format"},
    "/api/v1/profiles": {"format"},
}
STS2_QUERY_CHOICES = {"format": {"json", "markdown"}, "item_type": {"all", "card", "relic"}}
STS2_ACTION_TIMEOUT_S = 10.0
STS2_ACTION_SCHEMAS: dict[str, dict[str, tuple[str, Any]]] = {
    "menu_select": {"option": ("string", None), "seed": ("optional_string", None)},
    "play_card": {"card_index": ("index", None), "target": ("optional_string", None)},
    "use_potion": {"slot": ("index", None), "target": ("optional_string", None)},
    "discard_potion": {"slot": ("index", None)}, "end_turn": {},
    "combat_select_card": {"card_index": ("index", None)}, "combat_confirm_selection": {},
    "claim_reward": {"index": ("index", None)}, "select_card_reward": {"card_index": ("index", None)},
    "skip_card_reward": {}, "proceed": {}, "choose_event_option": {"index": ("index", None)},
    "advance_dialogue": {}, "choose_rest_option": {"index": ("index", None)},
    "shop_purchase": {"index": ("index", None)}, "choose_map_node": {"index": ("index", None)},
    "select_card": {"index": ("index", None)}, "confirm_selection": {}, "cancel_selection": {},
    "select_bundle": {"index": ("index", None)}, "confirm_bundle_selection": {}, "cancel_bundle_selection": {},
    "select_relic": {"index": ("index", None)}, "skip_relic_selection": {},
    "claim_treasure_relic": {"index": ("index", None)},
    "crystal_sphere_set_tool": {"tool": ("enum", {"big", "small"})},
    "crystal_sphere_click_cell": {"x": ("index", None), "y": ("index", None)},
    "crystal_sphere_proceed": {},
}

# Screenshot capture of the allowlisted game window.
STS2_WINDOW_NAME = "Slay the Spire 2"
MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024
SCREENSHOT_MIN_WIDTH = 320
SCREENSHOT_MAX_WIDTH = 1920
SCREENSHOT_DEFAULT_WIDTH = 1280
# When the game runs inside a headless gamescope, Xwayland holds no pixels, so
# frames come from gamescopectl instead of x11grab.
GAMESCOPE_SCREENSHOT_TIMEOUT_S = 6.0


KNOWN_NAMES = {
    "steam",
    "steamwebhelper",
    "gameoverlayui",
    "steam-runtime-launcher-service",
    "steam-runtime-launcher",
    "steam-launch-wrapper",
    "steamrt",
    "steamrt64",
    "steamwebhelper_sniper_wrap.sh",
    "srt-logger",
    "srt-bwrap",
    "pv-adverb",
    "reaper",
    "crashpad_handler",
    "slaythespire2",
}


class IOVec(ctypes.Structure):
    _fields_ = [("iov_base", ctypes.c_void_p), ("iov_len", ctypes.c_size_t)]


class GatewayError(Exception):
    def __init__(self, code: str, message: str, details: Any | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details


def reply_ok(result: Any) -> dict[str, Any]:
    return {"ok": True, "result": result}


def reply_error(error: GatewayError) -> dict[str, Any]:
    value: dict[str, Any] = {"code": error.code, "message": error.message}
    if error.details is not None:
        value["details"] = error.details
    return {"ok": False, "error": value}


class ProcessGateway:
    def __init__(
        self,
        home: Path,
        display: str | None,
        xauthority: str | None,
        token: str | None,
        sts2_port: int = STS2MCP_DEFAULT_PORT,
        gamescope_display: str | None = "auto",
    ):
        self.home = home.expanduser().resolve()
        self.display = display
        self.xauthority = xauthority
        self.token = token
        self.gamescope_display = gamescope_display
        self.sts2_base = f"http://{STS2MCP_HOST}:{sts2_port}"
        self.steam_roots = [
            self.home / ".local/share/Steam",
            self.home / ".steam/steam",
        ]
        self.sts2_roots = [
            self.home / ".local/share/SlayTheSpire2",
            self.home / ".local/share/Steam/steamapps/common/Slay the Spire 2",
        ]
        self.log_roots = [
            ("steam-logs", self.home / ".local/share/Steam/logs"),
            ("steam-logs-alt", self.home / ".steam/steam/logs"),
            ("sts2-logs", self.home / ".local/share/SlayTheSpire2/logs"),
            ("sts2-history", self.home / ".local/share/SlayTheSpire2/steam"),
        ]
        self.attached: set[int] = set()
        self.libc = ctypes.CDLL(ctypes.util.find_library("c") or "libc.so.6", use_errno=True)
        self._configure_libc()
        self._ptrace_jobs: queue.Queue[Any] = queue.Queue()
        self._ptrace_worker_ident: int | None = None
        self._ptrace_worker = threading.Thread(target=self._ptrace_worker_loop, daemon=True)
        self._ptrace_worker.start()

    def _ptrace_worker_loop(self) -> None:
        self._ptrace_worker_ident = threading.get_ident()
        while True:
            job = self._ptrace_jobs.get()
            if job is None:
                return
            function, result_queue = job
            try:
                result_queue.put((True, function()))
            except Exception as exc:  # Return operation errors to the requesting socket handler.
                result_queue.put((False, exc))

    def _ptrace_job(self, function: Any) -> Any:
        if threading.get_ident() == self._ptrace_worker_ident:
            return function()
        result_queue: queue.Queue[Any] = queue.Queue(1)
        self._ptrace_jobs.put((function, result_queue))
        success, result = result_queue.get()
        if success:
            return result
        raise result

    def _configure_libc(self) -> None:
        pid_t = ctypes.c_int
        ulong = ctypes.c_ulong
        self.libc.process_vm_readv.argtypes = [
            pid_t,
            ctypes.POINTER(IOVec),
            ulong,
            ctypes.POINTER(IOVec),
            ulong,
            ulong,
        ]
        self.libc.process_vm_readv.restype = ctypes.c_ssize_t
        self.libc.process_vm_writev.argtypes = [
            pid_t,
            ctypes.POINTER(IOVec),
            ulong,
            ctypes.POINTER(IOVec),
            ulong,
            ulong,
        ]
        self.libc.process_vm_writev.restype = ctypes.c_ssize_t
        self.libc.ptrace.argtypes = [
            ctypes.c_ulong,
            pid_t,
            ctypes.c_void_p,
            ctypes.c_void_p,
        ]
        self.libc.ptrace.restype = ctypes.c_long

    @staticmethod
    def _read(path: Path, limit: int = 2 * 1024 * 1024) -> bytes:
        with path.open("rb") as stream:
            return stream.read(limit)

    @staticmethod
    def _readlink(path: Path) -> str | None:
        try:
            return os.readlink(path)
        except OSError:
            return None

    @staticmethod
    def _under(path: str | Path | None, roots: list[Path]) -> bool:
        if not path:
            return False
        try:
            candidate = os.path.realpath(str(path))
            return any(os.path.commonpath([candidate, str(root)]) == str(root) for root in roots)
        except (OSError, ValueError):
            return False

    def _record(self, pid: int) -> dict[str, Any] | None:
        if pid <= 0:
            return None
        proc = Path("/proc") / str(pid)
        if not proc.is_dir():
            return None
        try:
            status_text = self._read(proc / "status", 256 * 1024).decode("utf-8", "replace")
            status: dict[str, str] = {}
            for line in status_text.splitlines():
                if ":" in line:
                    key, value = line.split(":", 1)
                    status[key] = value.strip()
            cmdline_bytes = self._read(proc / "cmdline", 1024 * 1024)
            cmdline = " ".join(part.decode("utf-8", "replace") for part in cmdline_bytes.split(b"\0") if part)
            fd_links = {
                str(fd): self._readlink(proc / "fd" / str(fd)) for fd in (0, 1, 2)
            }
            return {
                "pid": pid,
                "ppid": int(status.get("PPid", "0")),
                "name": status.get("Name", ""),
                "state": status.get("State", ""),
                "uid": status.get("Uid", "").split()[0] if status.get("Uid") else "",
                "exe": self._readlink(proc / "exe"),
                "cwd": self._readlink(proc / "cwd"),
                "cmdline": cmdline,
                "stdio": fd_links,
            }
        except (OSError, ValueError):
            return None

    def _records(self) -> dict[int, dict[str, Any]]:
        records: dict[int, dict[str, Any]] = {}
        try:
            names = os.listdir("/proc")
        except OSError as exc:
            raise GatewayError("proc_unavailable", f"Cannot enumerate /proc: {exc}") from exc
        for name in names:
            if not name.isdigit():
                continue
            record = self._record(int(name))
            if record:
                records[record["pid"]] = record
        return records

    def _directly_allowed(self, record: dict[str, Any]) -> bool:
        name = str(record.get("name", "")).lower()
        exe = str(record.get("exe") or "")
        cmdline = str(record.get("cmdline") or "")
        lowered = f"{exe} {cmdline}".lower()

        if self._under(exe, self.steam_roots + self.sts2_roots):
            return True
        if "slay the spire 2" in lowered or "slaythespire2" in lowered:
            return True
        if any(str(root).lower() in lowered for root in self.steam_roots):
            if name in KNOWN_NAMES or "steam.sh" in lowered:
                return True
        return name in KNOWN_NAMES and ("steam" in lowered or "slay" in lowered)

    def _allowed(self, pid: int, records: dict[int, dict[str, Any]] | None = None) -> dict[str, Any] | None:
        records = records or self._records()
        memo: dict[int, bool] = {}

        def visit(current: int, stack: set[int]) -> bool:
            if current in memo:
                return memo[current]
            if current in stack or current not in records:
                memo[current] = False
                return False
            record = records[current]
            if self._directly_allowed(record):
                memo[current] = True
                return True
            parent = int(record.get("ppid", 0))
            name = str(record.get("name", "")).lower()
            cmdline = str(record.get("cmdline", "")).lower()
            related_name = name in KNOWN_NAMES or "slay the spire 2" in cmdline or "slaythespire2" in cmdline
            result = related_name and visit(parent, stack | {current})
            memo[current] = result
            return result

        return records.get(pid) if visit(pid, set()) else None

    def target(self, value: Any, records: dict[int, dict[str, Any]] | None = None) -> dict[str, Any]:
        try:
            pid = int(value)
        except (TypeError, ValueError) as exc:
            raise GatewayError("invalid_pid", "PID must be an integer") from exc
        record = self._allowed(pid, records)
        if not record:
            raise GatewayError(
                "target_not_allowed",
                "PID is not a Steam or Slay the Spire 2 process",
                {"pid": pid},
            )
        return record

    def list_processes(self) -> list[dict[str, Any]]:
        records = self._records()
        return [records[pid] for pid in sorted(records) if self._allowed(pid, records)]

    def inspect(self, request: dict[str, Any]) -> dict[str, Any]:
        return self.target(request.get("pid"))

    def log_files(self) -> list[dict[str, Any]]:
        files: list[dict[str, Any]] = []
        for label, root in self.log_roots:
            if not root.is_dir():
                continue
            for directory, _, names in os.walk(root):
                for name in names:
                    path = Path(directory) / name
                    try:
                        resolved = path.resolve()
                        if not self._under(resolved, [root]) or not resolved.is_file():
                            continue
                        if label == "sts2-history" and resolved.name not in SPECIAL_LOG_NAMES:
                            continue
                        info = resolved.stat()
                        files.append(
                            {
                                "path": f"{label}/{resolved.relative_to(root)}",
                                "bytes": info.st_size,
                                "mtime": info.st_mtime,
                            }
                        )
                    except (OSError, ValueError):
                        continue
                    if len(files) >= 200:
                        return files
        return sorted(files, key=lambda item: item["path"])

    def _log_path(self, value: Any) -> Path:
        if not isinstance(value, str) or "/" not in value:
            raise GatewayError("invalid_log_path", "Use a gateway-relative label/path from log-files")
        label, relative = value.split("/", 1)
        roots = dict(self.log_roots)
        root = roots.get(label)
        if not root:
            raise GatewayError("invalid_log_path", "Log root is not allowlisted")
        candidate = (root / relative).resolve()
        if not self._under(candidate, [root]) or not candidate.is_file():
            raise GatewayError("invalid_log_path", "Log path is not allowlisted or does not exist")
        if label == "sts2-history" and candidate.name not in SPECIAL_LOG_NAMES:
            raise GatewayError("invalid_log_path", "Only console history is allowlisted in the STS2 data directory")
        return candidate

    def read_log(self, request: dict[str, Any]) -> dict[str, Any]:
        path = self._log_path(request.get("path"))
        try:
            lines = max(1, min(int(request.get("lines", 80)), 2000))
        except (TypeError, ValueError) as exc:
            raise GatewayError("invalid_lines", "lines must be an integer") from exc
        try:
            with path.open("rb") as stream:
                stream.seek(0, os.SEEK_END)
                size = stream.tell()
                stream.seek(max(0, size - MAX_LOG_BYTES), os.SEEK_SET)
                text = stream.read(MAX_LOG_BYTES).decode("utf-8", "replace")
        except OSError as exc:
            raise GatewayError("log_read_failed", str(exc)) from exc
        return {"path": str(path), "text": "\n".join(text.splitlines()[-lines:])}

    def read_output(self, request: dict[str, Any]) -> dict[str, Any]:
        record = self.target(request.get("pid"))
        try:
            fd = int(request.get("fd", 1))
        except (TypeError, ValueError) as exc:
            raise GatewayError("invalid_fd", "fd must be 0, 1, or 2") from exc
        if fd not in (0, 1, 2):
            raise GatewayError("invalid_fd", "fd must be 0, 1, or 2")
        target = record["stdio"].get(str(fd))
        if not target:
            raise GatewayError("stdio_unavailable", "The process fd is unavailable")
        consume = bool(request.get("consume", False))
        if target.startswith("pipe:") and not consume:
            return {
                "pid": record["pid"],
                "fd": fd,
                "target": target,
                "readable": False,
                "reason": "Reading a pipe consumes output shared with the parent process; retry with consume=true",
            }
        proc_fd = Path("/proc") / str(record["pid"]) / "fd" / str(fd)
        try:
            handle = os.open(proc_fd, os.O_RDONLY | os.O_NONBLOCK | os.O_CLOEXEC)
        except OSError as exc:
            raise GatewayError("stdio_open_failed", str(exc), {"target": target}) from exc
        chunks: list[bytes] = []
        total = 0
        try:
            while total < MAX_LOG_BYTES:
                try:
                    chunk = os.read(handle, min(64 * 1024, MAX_LOG_BYTES - total))
                except BlockingIOError:
                    break
                if not chunk:
                    break
                chunks.append(chunk)
                total += len(chunk)
        finally:
            os.close(handle)
        data = b"".join(chunks)
        return {
            "pid": record["pid"],
            "fd": fd,
            "target": target,
            "readable": True,
            "consumed": target.startswith("pipe:"),
            "data_base64": base64.b64encode(data).decode("ascii"),
        }

    def _display_env(self) -> dict[str, str]:
        env = os.environ.copy()
        if self.display:
            env["DISPLAY"] = self.display
        if self.xauthority:
            env["XAUTHORITY"] = self.xauthority
        return env

    def _xdotool(self, *args: str) -> str:
        try:
            result = subprocess.run(
                ["xdotool", *args],
                env=self._display_env(),
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise GatewayError("display_command_failed", str(exc)) from exc
        if result.returncode:
            raise GatewayError("display_command_failed", result.stderr.strip() or "xdotool failed")
        return result.stdout.strip()

    def windows(self) -> list[dict[str, Any]]:
        records = self._records()
        try:
            ids = self._xdotool("search", "--onlyvisible", "--name", ".*").splitlines()
        except GatewayError:
            return []
        windows: list[dict[str, Any]] = []
        for raw_id in ids:
            if not raw_id.isdigit():
                continue
            window_id = int(raw_id)
            try:
                pid_text = self._xdotool("getwindowpid", str(window_id))
                pid = int(pid_text)
            except (GatewayError, ValueError):
                continue
            if not self._allowed(pid, records):
                continue
            try:
                name = self._xdotool("getwindowname", str(window_id))
            except GatewayError:
                name = ""
            geometry: dict[str, int] = {}
            try:
                geometry_text = self._xdotool("getwindowgeometry", "--shell", str(window_id))
                for line in geometry_text.splitlines():
                    key, _, value = line.partition("=")
                    if key in {"X", "Y", "WIDTH", "HEIGHT", "SCREEN"}:
                        geometry[key.lower()] = int(value)
            except (GatewayError, ValueError):
                pass
            windows.append({"window": window_id, "pid": pid, "name": name, "geometry": geometry})
        return windows

    def _window(self, pid: Any) -> tuple[dict[str, Any], dict[str, Any]]:
        record = self.target(pid)
        windows = [item for item in self.windows() if item["pid"] == record["pid"]]
        if not windows:
            raise GatewayError("window_not_found", "No visible X11 window belongs to that target process")
        return record, windows[0]

    def window_key(self, request: dict[str, Any]) -> dict[str, Any]:
        _, window = self._window(request.get("pid"))
        keys = request.get("keys")
        if not isinstance(keys, list) or not keys or len(keys) > 32:
            raise GatewayError("invalid_keys", "keys must be a non-empty list of at most 32 key names")
        if any(not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_+:-]+", key) for key in keys):
            raise GatewayError("invalid_keys", "key names contain unsupported characters")
        self._xdotool("key", "--window", str(window["window"]), "--clearmodifiers", *keys)
        return {"window": window, "keys": keys}

    def window_type(self, request: dict[str, Any]) -> dict[str, Any]:
        _, window = self._window(request.get("pid"))
        text = request.get("text")
        if not isinstance(text, str) or len(text) > 4096:
            raise GatewayError("invalid_text", "text must be a string of at most 4096 characters")
        self._xdotool("type", "--window", str(window["window"]), "--delay", "0", "--", text)
        return {"window": window, "characters": len(text)}

    def window_click(self, request: dict[str, Any]) -> dict[str, Any]:
        _, window = self._window(request.get("pid"))
        try:
            button = int(request.get("button", 1))
            x = int(request["x"])
            y = int(request["y"])
        except (KeyError, TypeError, ValueError) as exc:
            raise GatewayError("invalid_click", "button, x, and y must be integers") from exc
        if button not in range(1, 6) or abs(x) > 100000 or abs(y) > 100000:
            raise GatewayError("invalid_click", "click coordinates or button are out of range")
        self._xdotool("mousemove", "--window", str(window["window"]), str(x), str(y))
        self._xdotool("click", "--window", str(window["window"]), str(button))
        return {"window": window, "button": button, "x": x, "y": y}

    # -- STS2MCP proxy -----------------------------------------------------------

    def sts2_get(self, request: dict[str, Any]) -> dict[str, Any]:
        path = request.get("path")
        if not isinstance(path, str) or path not in STS2_GET_ALLOWLIST:
            raise GatewayError("invalid_path", "path is not an allowlisted STS2MCP GET endpoint", {"allowed": sorted(STS2_GET_ALLOWLIST)})
        query = request.get("query") or {}
        if not isinstance(query, dict):
            raise GatewayError("invalid_query", "query must be an object")
        allowed_keys = STS2_GET_ALLOWLIST[path]
        params: dict[str, str] = {}
        for key, value in query.items():
            if key not in allowed_keys:
                raise GatewayError("invalid_query", f"query parameter not allowed for {path}: {key}", {"allowed": sorted(allowed_keys)})
            if key in STS2_QUERY_CHOICES:
                if value not in STS2_QUERY_CHOICES[key]:
                    raise GatewayError("invalid_query", f"{key} must be one of {sorted(STS2_QUERY_CHOICES[key])}")
                params[key] = str(value)
            elif key == "limit":
                if not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= 50:
                    raise GatewayError("invalid_query", "limit must be an integer between 1 and 50")
                params[key] = str(value)
            elif key == "query":
                if not isinstance(value, str) or not value.strip() or len(value) > 200:
                    raise GatewayError("invalid_query", "query must be a non-empty string of at most 200 characters")
                params[key] = value
        url = self.sts2_base + path
        if params:
            url += "?" + urllib.parse.urlencode(params)
        http_request = urllib.request.Request(url, method="GET", headers={"Accept": "application/json, text/markdown, text/plain"})
        last_error: GatewayError | None = None
        for attempt in range(3):
            if attempt:
                time.sleep(0.3)
            try:
                with urllib.request.urlopen(http_request, timeout=10) as response:
                    body = response.read(MAX_STS2_BYTES + 1)
                    status = response.status
                    content_type = response.headers.get("Content-Type", "")
                break
            except urllib.error.HTTPError as exc:
                excerpt = exc.read(4096).decode("utf-8", "replace")
                error = GatewayError("sts2_http_error", f"STS2MCP returned HTTP {exc.code}", {"status": exc.code, "body": excerpt})
                if exc.code < 500:
                    raise error from exc
                last_error = error
            except (urllib.error.URLError, OSError, TimeoutError) as exc:
                last_error = GatewayError(
                    "sts2_unavailable",
                    f"STS2MCP is not reachable at {self.sts2_base}; is the game running with the mod enabled?",
                    {"reason": str(getattr(exc, "reason", exc))},
                )
        else:
            raise last_error or GatewayError("sts2_unavailable", "STS2MCP GET failed after 3 attempts")
        if len(body) > MAX_STS2_BYTES:
            raise GatewayError("sts2_too_large", f"STS2MCP response exceeds {MAX_STS2_BYTES} bytes")
        return {"status": status, "content_type": content_type, "bytes": len(body), "body": body.decode("utf-8", "replace")}

    def sts2_action(self, request: dict[str, Any]) -> dict[str, Any]:
        action = request.get("action")
        if not isinstance(action, str) or action not in STS2_ACTION_SCHEMAS:
            raise GatewayError("invalid_action", "action is not allowlisted", {"allowed": sorted(STS2_ACTION_SCHEMAS)})
        params = request.get("params", {})
        if not isinstance(params, dict):
            raise GatewayError("invalid_params", "params must be an object")
        schema = STS2_ACTION_SCHEMAS[action]
        extras = set(params) - set(schema)
        if extras:
            raise GatewayError("invalid_params", f"parameter not allowed for {action}: {sorted(extras)[0]}", {"allowed": sorted(schema)})
        clean: dict[str, Any] = {}
        for key, (kind, choices) in schema.items():
            optional = kind.startswith("optional_")
            if key not in params:
                if optional:
                    continue
                raise GatewayError("invalid_params", f"{action}.{key} is required")
            value = params[key]
            kind = kind.removeprefix("optional_")
            if kind == "index" and (isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 10000):
                raise GatewayError("invalid_params", f"{action}.{key} must be an integer from 0 to 10000")
            if kind == "string" and (not isinstance(value, str) or not value or len(value) > 160):
                raise GatewayError("invalid_params", f"{action}.{key} must be a 1-160 character string")
            if kind == "enum" and value not in choices:
                raise GatewayError("invalid_params", f"{action}.{key} must be one of {sorted(choices)}")
            clean[key] = value
        payload = json.dumps({"action": action, **clean}, separators=(",", ":")).encode("utf-8")
        http_request = urllib.request.Request(
            self.sts2_base + "/api/v1/singleplayer", data=payload, method="POST",
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(http_request, timeout=STS2_ACTION_TIMEOUT_S) as response:
                body = response.read(MAX_STS2_BYTES + 1)
                status = response.status
        except urllib.error.HTTPError as exc:
            excerpt = exc.read(4096).decode("utf-8", "replace")
            raise GatewayError("sts2_http_error", f"STS2MCP returned HTTP {exc.code}", {"status": exc.code, "body": excerpt}) from exc
        except (urllib.error.URLError, OSError, TimeoutError) as exc:
            # A write is never retried: the mod may have applied it before the
            # connection was lost.
            raise GatewayError("sts2_action_outcome_unknown", "STS2MCP connection was lost after action dispatch; outcome is unknown and must be reviewed", {"action": action, "reason": str(getattr(exc, "reason", exc))}) from exc
        if len(body) > MAX_STS2_BYTES:
            raise GatewayError("sts2_too_large", f"STS2MCP response exceeds {MAX_STS2_BYTES} bytes")
        try:
            result = json.loads(body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise GatewayError("sts2_malformed_response", "STS2MCP action response is not valid JSON") from exc
        if status >= 400:
            raise GatewayError("sts2_http_error", f"STS2MCP returned HTTP {status}", {"status": status, "result": result})
        if not isinstance(result, dict) or result.get("status") != "ok":
            message = result.get("error") or result.get("message") if isinstance(result, dict) else None
            raise GatewayError("sts2_action_failed", str(message or "STS2MCP rejected the action"), {"result": result})
        return {"action": action, "params": clean, "acknowledgement": result}

    # -- Screenshot ---------------------------------------------------------------

    def _sts2_window(self, pid: Any) -> dict[str, Any]:
        if pid is not None:
            return self._window(pid)[1]
        for window in self.windows():
            if window.get("name") == STS2_WINDOW_NAME:
                return window
        raise GatewayError("window_not_found", f"No visible window named {STS2_WINDOW_NAME!r} belongs to an allowlisted process")

    def _gamescope_socket(self) -> str | None:
        """Name of the gamescope Wayland socket to capture from, or None for plain X11."""
        if not self.gamescope_display:
            return None
        runtime_dir = Path(os.environ.get("XDG_RUNTIME_DIR", f"/run/user/{os.getuid()}"))
        if self.gamescope_display != "auto":
            return self.gamescope_display if (runtime_dir / self.gamescope_display).exists() else None
        candidates = sorted(
            p.name for p in runtime_dir.glob("gamescope-[0-9]*")
            if not p.name.endswith((".lock", "-ei")) and p.is_socket()
        )
        return candidates[0] if candidates else None

    def _gamescope_capture(self, socket_name: str) -> bytes:
        tool = shutil.which("gamescopectl") or "/usr/games/gamescopectl"
        env = os.environ.copy()
        env["GAMESCOPE_WAYLAND_DISPLAY"] = socket_name
        with tempfile.TemporaryDirectory(prefix="steambench-shot-") as tmp:
            path = Path(tmp) / "shot.png"
            try:
                result = subprocess.run([tool, "screenshot", str(path)], env=env, capture_output=True, timeout=10, check=False)
            except (OSError, subprocess.TimeoutExpired) as exc:
                raise GatewayError("display_command_failed", f"gamescopectl failed: {exc}") from exc
            if result.returncode:
                raise GatewayError("display_command_failed", result.stderr.decode("utf-8", "replace").strip() or "gamescopectl failed")
            # gamescopectl returns before the compositor has written the file; wait for a stable size.
            deadline = time.monotonic() + GAMESCOPE_SCREENSHOT_TIMEOUT_S
            last_size = -1
            while time.monotonic() < deadline:
                size = path.stat().st_size if path.exists() else 0
                if size > 0 and size == last_size:
                    return path.read_bytes()
                last_size = size
                time.sleep(0.1)
        raise GatewayError("display_command_failed", "gamescope did not produce a screenshot in time")

    @staticmethod
    def _png_size(data: bytes) -> tuple[int | None, int | None]:
        if data[:8] == b"\x89PNG\r\n\x1a\n" and data[12:16] == b"IHDR":
            return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
        return None, None

    def screenshot(self, request: dict[str, Any]) -> dict[str, Any]:
        try:
            width = int(request.get("width", SCREENSHOT_DEFAULT_WIDTH))
        except (TypeError, ValueError) as exc:
            raise GatewayError("invalid_width", "width must be an integer") from exc
        if not SCREENSHOT_MIN_WIDTH <= width <= SCREENSHOT_MAX_WIDTH:
            raise GatewayError("invalid_width", f"width must be between {SCREENSHOT_MIN_WIDTH} and {SCREENSHOT_MAX_WIDTH}")
        image_format = request.get("format", "png")
        if image_format not in {"png", "jpeg"}:
            raise GatewayError("invalid_format", "format must be png or jpeg")
        encode = ["-c:v", "png"] if image_format == "png" else ["-c:v", "mjpeg", "-q:v", "3"]

        gamescope = self._gamescope_socket()
        if gamescope:
            raw = self._gamescope_capture(gamescope)
            source_width, source_height = self._png_size(raw)
            source: dict[str, Any] = {"source": "gamescope", "display": gamescope, "width": source_width, "height": source_height}
            command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-frames:v", "1", "-vf", f"scale={width}:-2", "-f", "image2pipe", *encode, "pipe:1"]
            stdin: bytes | None = raw
            env = os.environ.copy()
        else:
            window = self._sts2_window(request.get("pid"))
            geometry = window.get("geometry") or {}
            source_width, source_height = geometry.get("width"), geometry.get("height")
            source = {"source": "x11", **window}
            command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "x11grab", "-window_id", str(window["window"])]
            if source_width and source_height:
                command += ["-video_size", f"{source_width}x{source_height}"]
            command += ["-i", self.display or ":0", "-frames:v", "1", "-vf", f"scale={width}:-2", "-f", "image2pipe", *encode, "pipe:1"]
            stdin = None
            env = self._display_env()
        try:
            result = subprocess.run(command, input=stdin, env=env, capture_output=True, timeout=15, check=False)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise GatewayError("display_command_failed", str(exc)) from exc
        if result.returncode or not result.stdout:
            raise GatewayError("display_command_failed", result.stderr.decode("utf-8", "replace").strip() or "ffmpeg produced no image")
        if len(result.stdout) > MAX_SCREENSHOT_BYTES:
            raise GatewayError("screenshot_too_large", f"screenshot exceeds {MAX_SCREENSHOT_BYTES} bytes; lower width")
        height = round(source_height * width / source_width) if source_width and source_height else None
        return {
            "window": source,
            "width": width,
            "height": height,
            "format": image_format,
            "bytes": len(result.stdout),
            "data_base64": base64.b64encode(result.stdout).decode("ascii"),
        }

    def signal(self, request: dict[str, Any]) -> dict[str, Any]:
        record = self.target(request.get("pid"))
        value = str(request.get("signal", "SIGTERM")).upper()
        if not value.startswith("SIG"):
            value = f"SIG{value}"
        number = getattr(signal, value, None)
        if not isinstance(number, signal.Signals):
            raise GatewayError("invalid_signal", f"Unknown signal: {value}")
        try:
            os.kill(record["pid"], number)
        except OSError as exc:
            raise GatewayError("signal_failed", str(exc)) from exc
        return {"pid": record["pid"], "signal": value}

    @staticmethod
    def _address(value: Any) -> int:
        try:
            address = int(str(value), 0)
        except ValueError as exc:
            raise GatewayError("invalid_address", "Address must be an integer or 0x-prefixed value") from exc
        if address < 0:
            raise GatewayError("invalid_address", "Address must be non-negative")
        return address

    @staticmethod
    def _length(value: Any) -> int:
        try:
            length = int(value)
        except (TypeError, ValueError) as exc:
            raise GatewayError("invalid_length", "Length must be an integer") from exc
        if length <= 0 or length > MAX_MEMORY:
            raise GatewayError("invalid_length", f"Length must be between 1 and {MAX_MEMORY}")
        return length

    def memory_read(self, request: dict[str, Any]) -> dict[str, Any]:
        record = self.target(request.get("pid"))
        address = self._address(request.get("address"))
        length = self._length(request.get("length"))
        buffer = ctypes.create_string_buffer(length)
        local = IOVec(ctypes.cast(buffer, ctypes.c_void_p), length)
        remote = IOVec(ctypes.c_void_p(address), length)
        ctypes.set_errno(0)
        count = self.libc.process_vm_readv(record["pid"], ctypes.byref(local), 1, ctypes.byref(remote), 1, 0)
        if count < 0:
            error = ctypes.get_errno()
            raise GatewayError("memory_read_failed", os.strerror(error), {"errno": error})
        data = buffer.raw[:count]
        return {
            "pid": record["pid"],
            "address": hex(address),
            "bytes": count,
            "data_base64": base64.b64encode(data).decode("ascii"),
        }

    def memory_maps(self, request: dict[str, Any]) -> dict[str, Any]:
        record = self.target(request.get("pid"))
        try:
            text = self._read(Path("/proc") / str(record["pid"]) / "maps", 2 * 1024 * 1024).decode(
                "utf-8", "replace"
            )
        except OSError as exc:
            raise GatewayError("maps_read_failed", str(exc)) from exc
        return {"pid": record["pid"], "text": text}

    def memory_write(self, request: dict[str, Any]) -> dict[str, Any]:
        record = self.target(request.get("pid"))
        address = self._address(request.get("address"))
        encoded = request.get("data_base64")
        hex_data = request.get("hex")
        try:
            if isinstance(encoded, str):
                data = base64.b64decode(encoded, validate=True)
            elif isinstance(hex_data, str):
                data = bytes.fromhex(hex_data)
            else:
                raise GatewayError("invalid_data", "Provide data_base64 or hex")
        except (ValueError, base64.binascii.Error) as exc:
            raise GatewayError("invalid_data", "Memory data is not valid base64 or hex") from exc
        if not data or len(data) > MAX_MEMORY:
            raise GatewayError("invalid_data", f"Data must be between 1 and {MAX_MEMORY} bytes")
        buffer = ctypes.create_string_buffer(data, len(data))
        local = IOVec(ctypes.cast(buffer, ctypes.c_void_p), len(data))
        remote = IOVec(ctypes.c_void_p(address), len(data))
        ctypes.set_errno(0)
        count = self.libc.process_vm_writev(record["pid"], ctypes.byref(local), 1, ctypes.byref(remote), 1, 0)
        if count < 0:
            error = ctypes.get_errno()
            raise GatewayError("memory_write_failed", os.strerror(error), {"errno": error})
        return {"pid": record["pid"], "address": hex(address), "bytes": count}

    def _ptrace_raw(self, request: int, pid: int, address: int = 0, data: int = 0) -> int:
        ctypes.set_errno(0)
        result = self.libc.ptrace(
            request,
            pid,
            ctypes.c_void_p(address),
            ctypes.c_void_p(data & ((1 << (ctypes.sizeof(ctypes.c_void_p) * 8)) - 1)),
        )
        error = ctypes.get_errno()
        if result == -1 and error:
            raise GatewayError("ptrace_failed", os.strerror(error), {"errno": error, "request": request})
        return int(result)

    def _ptrace(self, request: int, pid: int, address: int = 0, data: int = 0) -> int:
        return self._ptrace_job(lambda: self._ptrace_raw(request, pid, address, data))

    def ptrace_attach(self, request: dict[str, Any]) -> dict[str, Any]:
        record = self.target(request.get("pid"))
        pid = record["pid"]
        if pid in self.attached:
            return {"pid": pid, "attached": True}
        def attach() -> None:
            self._ptrace_raw(16, pid)  # PTRACE_ATTACH
            try:
                os.waitpid(pid, 0)
            except OSError as exc:
                raise GatewayError("ptrace_wait_failed", str(exc)) from exc

        self._ptrace_job(attach)
        self.attached.add(pid)
        return {"pid": pid, "attached": True}

    def ptrace_detach(self, request: dict[str, Any]) -> dict[str, Any]:
        record = self.target(request.get("pid"))
        pid = record["pid"]
        if pid in self.attached:
            self._ptrace_job(lambda: self._ptrace_raw(17, pid))  # PTRACE_DETACH
            self.attached.discard(pid)
        return {"pid": pid, "attached": False}

    def ptrace_continue(self, request: dict[str, Any]) -> dict[str, Any]:
        record = self.target(request.get("pid"))
        pid = record["pid"]
        if pid not in self.attached:
            raise GatewayError("ptrace_not_attached", "Attach before continue")
        self._ptrace_job(lambda: self._ptrace_raw(7, pid))  # PTRACE_CONT
        self.attached.discard(pid)
        return {"pid": pid, "continued": True}

    def ptrace_peek(self, request: dict[str, Any]) -> dict[str, Any]:
        record = self.target(request.get("pid"))
        pid = record["pid"]
        if pid not in self.attached:
            raise GatewayError("ptrace_not_attached", "Attach before peek")
        address = self._address(request.get("address"))
        value = self._ptrace_job(lambda: self._ptrace_raw(2, pid, address))  # PTRACE_PEEKDATA
        width = ctypes.sizeof(ctypes.c_long)
        return {"pid": pid, "address": hex(address), "bytes": width, "value_hex": (value & ((1 << (width * 8)) - 1)).to_bytes(width, "little").hex()}

    def ptrace_poke(self, request: dict[str, Any]) -> dict[str, Any]:
        record = self.target(request.get("pid"))
        pid = record["pid"]
        if pid not in self.attached:
            raise GatewayError("ptrace_not_attached", "Attach before poke")
        address = self._address(request.get("address"))
        value_text = str(request.get("value_hex", ""))
        try:
            value = int.from_bytes(bytes.fromhex(value_text), "little")
        except ValueError as exc:
            raise GatewayError("invalid_value", "value_hex must contain hexadecimal bytes") from exc
        width = ctypes.sizeof(ctypes.c_long)
        if len(value_text) != width * 2:
            raise GatewayError("invalid_value", f"value_hex must be exactly {width} bytes")
        self._ptrace_job(lambda: self._ptrace_raw(5, pid, address, value))  # PTRACE_POKEDATA
        return {"pid": pid, "address": hex(address), "value_hex": value_text}

    def dispatch(self, request: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(request, dict):
            raise GatewayError("invalid_request", "Request must be a JSON object")
        if self.token is not None and request.get("token") != self.token:
            raise GatewayError("unauthorized", "A valid gateway token is required")
        operation = request.get("op")
        operations = {
            "list": lambda: self.list_processes(),
            "inspect": lambda: self.inspect(request),
            "log-files": lambda: self.log_files(),
            "read-log": lambda: self.read_log(request),
            "read-output": lambda: self.read_output(request),
            "windows": lambda: self.windows(),
            "window-key": lambda: self.window_key(request),
            "window-type": lambda: self.window_type(request),
            "window-click": lambda: self.window_click(request),
            "signal": lambda: self.signal(request),
            "memory-read": lambda: self.memory_read(request),
            "memory-maps": lambda: self.memory_maps(request),
            "memory-write": lambda: self.memory_write(request),
            "ptrace-attach": lambda: self.ptrace_attach(request),
            "ptrace-detach": lambda: self.ptrace_detach(request),
            "ptrace-continue": lambda: self.ptrace_continue(request),
            "ptrace-peek": lambda: self.ptrace_peek(request),
            "ptrace-poke": lambda: self.ptrace_poke(request),
            "sts2-get": lambda: self.sts2_get(request),
            "sts2-action": lambda: self.sts2_action(request),
            "screenshot": lambda: self.screenshot(request),
        }
        handler = operations.get(operation)
        if not handler:
            raise GatewayError("unknown_operation", f"Unsupported operation: {operation}")
        return reply_ok(handler())

    def close(self) -> None:
        for pid in list(self.attached):
            try:
                self._ptrace_job(lambda p=pid: self._ptrace_raw(17, p))
            except GatewayError:
                pass
            self.attached.discard(pid)
        self._ptrace_jobs.put(None)
        self._ptrace_worker.join(timeout=1)


class GatewayServer(socketserver.ThreadingUnixStreamServer):
    daemon_threads = True
    allow_reuse_address = True


class GatewayTCPServer(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


class GatewayHandler(socketserver.StreamRequestHandler):
    def handle(self) -> None:
        line = self.rfile.readline(MAX_REQUEST + 1)
        if len(line) > MAX_REQUEST:
            response = reply_error(GatewayError("request_too_large", "Request exceeds the size limit"))
        else:
            try:
                request = json.loads(line.decode("utf-8"))
                response = self.server.gateway.dispatch(request)  # type: ignore[attr-defined]
            except (json.JSONDecodeError, UnicodeDecodeError) as exc:
                response = reply_error(GatewayError("invalid_json", str(exc)))
            except GatewayError as exc:
                response = reply_error(exc)
            except Exception as exc:  # Keep the socket protocol alive on unexpected process races.
                response = reply_error(GatewayError("internal_error", f"{type(exc).__name__}: {exc}"))
        self.wfile.write((json.dumps(response, separators=(",", ":")) + "\n").encode("utf-8"))


def owner_ids(owner: str | None) -> tuple[int | None, int | None]:
    if not owner:
        return None, None
    try:
        entry = pwd.getpwnam(owner)
    except KeyError as exc:
        raise SystemExit(f"unknown socket owner: {owner}") from exc
    return entry.pw_uid, entry.pw_gid


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    endpoint = parser.add_mutually_exclusive_group(required=True)
    endpoint.add_argument("--socket", type=Path, help="Unix socket path for local clients")
    endpoint.add_argument("--tcp", metavar="HOST:PORT", help="Loopback TCP endpoint for Docker Desktop clients")
    parser.add_argument("--home", required=True, type=Path, help="Home directory whose Steam/STS2 processes are allowlisted")
    parser.add_argument("--display", default=os.environ.get("DISPLAY"), help="X11 DISPLAY, normally :0")
    parser.add_argument("--xauthority", default=os.environ.get("XAUTHORITY"), help="Xauthority file for xdotool")
    parser.add_argument("--socket-owner", default=os.environ.get("SUDO_USER") or os.environ.get("USER"))
    parser.add_argument("--token", default=os.environ.get("STEAMBENCH_PROCESS_TOKEN"), help="Optional shared token for TCP clients")
    parser.add_argument(
        "--sts2-port",
        type=int,
        default=int(os.environ.get("STEAMBENCH_STS2_PORT", STS2MCP_DEFAULT_PORT)),
        help="Loopback port of the STS2MCP mod HTTP API",
    )
    parser.add_argument(
        "--gamescope-display",
        default=os.environ.get("STEAMBENCH_GAMESCOPE_DISPLAY", "auto"),
        help="gamescope Wayland socket to screenshot from (e.g. gamescope-0), 'auto' to detect, or '' to force x11grab",
    )
    args = parser.parse_args()
    if not 1 <= args.sts2_port <= 65535:
        raise SystemExit("--sts2-port must be between 1 and 65535")

    socket_path: Path | None = None
    if args.socket:
        socket_path = args.socket.expanduser().absolute()
        socket_path.parent.mkdir(parents=True, exist_ok=True)
        if socket_path.exists():
            if not stat.S_ISSOCK(socket_path.stat().st_mode):
                raise SystemExit(f"refusing to replace non-socket: {socket_path}")
            socket_path.unlink()
        server = GatewayServer(str(socket_path), GatewayHandler)
        endpoint_description = str(socket_path)
    else:
        host, separator, port_text = args.tcp.rpartition(":")
        if not separator or not host:
            raise SystemExit("--tcp must be HOST:PORT")
        if host == "localhost":
            host = "127.0.0.1"
        if host not in {"127.0.0.1", "::1"}:
            raise SystemExit("refusing non-loopback TCP bind; use a local allowlisted transport")
        try:
            port = int(port_text)
        except ValueError as exc:
            raise SystemExit("--tcp port must be an integer") from exc
        if not 1 <= port <= 65535:
            raise SystemExit("--tcp port must be between 1 and 65535")
        server = GatewayTCPServer((host, port), GatewayHandler)
        endpoint_description = f"{host}:{server.server_address[1]}"

    gateway = ProcessGateway(
        args.home,
        args.display,
        args.xauthority,
        args.token,
        sts2_port=args.sts2_port,
        gamescope_display=args.gamescope_display or None,
    )
    server.gateway = gateway  # type: ignore[attr-defined]
    if socket_path is not None:
        uid, gid = owner_ids(args.socket_owner)
        if uid is not None and gid is not None and os.geteuid() == 0:
            os.chown(socket_path, uid, gid)
        os.chmod(socket_path, 0o660)

    def shutdown(_signum: int, _frame: Any) -> None:
        # BaseServer.shutdown must run outside the serve_forever thread.
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)
    print(f"steambench gateway listening on {endpoint_description}", flush=True)
    try:
        server.serve_forever(poll_interval=0.2)
    finally:
        gateway.close()
        server.server_close()
        if socket_path is not None:
            try:
                socket_path.unlink()
            except FileNotFoundError:
                pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
