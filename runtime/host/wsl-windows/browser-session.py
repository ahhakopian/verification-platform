"""Current-process browser discovery and WSL-local TCP transport (no CDP client).

Run once per task setup; keep alive until final detach/cleanup. No profile or
browser state is deleted, and no browser WebSocket URL is persisted.
"""

import argparse
import http.client
import json
from pathlib import Path, PureWindowsPath
import socket
import socketserver
import subprocess
import sys
import threading
import time
from urllib.parse import urlsplit


def validate_config(config):
    if not isinstance(config, dict):
        raise Blocked("Runtime configuration must be an object.")
    for key in ("executable", "profile"):
        value = config.get(key)
        if not isinstance(value, str) or not value or '"' in value or "\n" in value or "\r" in value:
            raise Blocked(f"Explicit Windows {key} is required.")
        if not PureWindowsPath(value).is_absolute():
            raise Blocked(f"Windows {key} must be absolute.")
    if type(config.get("debugPort")) is not int or not 1 <= config["debugPort"] <= 65535:
        raise Blocked("Explicit debugPort in 1..65535 is required.")
    if "version" in config and (not isinstance(config["version"], str) or not config["version"]):
        raise Blocked("Optional exact version constraint must be a nonempty string.")
    return config


class Blocked(RuntimeError):
    pass


def validate_snapshot(record, config):
    validate_config(config)
    if not isinstance(record, dict) or record.get("status") != "ok":
        raise Blocked(record.get("detail", "Browser is unavailable.") if isinstance(record, dict) else "Missing browser evidence.")
    if (record.get("binary", "").casefold() != config["executable"].casefold()
            or record.get("profile", "").casefold() != config["profile"].casefold()
            or not record.get("version")
            or (config.get("version") and record["version"] != config["version"])):
        raise Blocked("Configured browser binary/version/profile is unproved.")
    if type(record.get("process_id")) is not int or record["process_id"] <= 0 or not record.get("started_at"):
        raise Blocked("Current browser process identity is missing.")
    ws = urlsplit(record.get("webSocketDebuggerUrl", ""))
    if (ws.scheme != "ws" or ws.hostname not in ("127.0.0.1", "localhost", "::1")
            or ws.port != config["debugPort"] or not ws.path.startswith("/devtools/browser/")
            or not ws.path.removeprefix("/devtools/browser/")
            or "/" in ws.path.removeprefix("/devtools/browser/") or ws.query or ws.fragment):
        raise Blocked("Fresh /json/version browser WebSocket is required.")
    return record


def incarnation(record):
    return (record["process_id"], record["started_at"], record["webSocketDebuggerUrl"])


def validate_closed_baseline(record, config):
    if isinstance(record, dict) and record.get("state") == "RUNNING":
        return validate_snapshot(record, config)
    validate_config(config)
    if (not isinstance(record, dict) or record.get("status") != "ok" or record.get("state") != "STOPPED"
            or record.get("binary", "").casefold() != config["executable"].casefold()
            or record.get("profile", "").casefold() != config["profile"].casefold()
            or not record.get("version") or (config.get("version") and record["version"] != config["version"])
            or type(record.get("profileProcessCount")) is not int or record["profileProcessCount"] != 0
            or type(record.get("listenerCount")) is not int or record["listenerCount"] != 0):
        raise Blocked("Closed baseline absence is unproved: " + str(record))
    return record


class Windows:
    def __init__(self, config_path, powershell):
        self.config = validate_config(json.loads(Path(config_path).read_text()))
        self.powershell = powershell
        self.config_path = subprocess.check_output(["wslpath", "-w", str(Path(config_path).resolve())], text=True).strip()
        script = Path(__file__).with_name("browser-runtime.ps1")
        self.script = subprocess.check_output(["wslpath", "-w", str(script)], text=True).strip()

    def command(self, operation):
        return [self.powershell, "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                "-File", self.script, "-ConfigPath", self.config_path, "-Operation", operation]

    def startup_timeout(self, default, phase):
        deadline = getattr(self, "readiness_deadline", None)
        if deadline is None:
            return default
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise Blocked(f"Runtime readiness deadline exhausted before {phase}.")
        return remaining

    def snapshot(self, launch=False):
        timeout = min(30, self.startup_timeout(30, "Windows runtime inspection"))
        result = subprocess.run(self.command("ensure" if launch else "inspect"), capture_output=True, text=True, timeout=timeout)
        try:
            record = json.loads(result.stdout.lstrip("\ufeff"))
        except ValueError as exc:
            raise Blocked("Windows browser inspection failed: " + result.stderr.strip()) from exc
        return validate_snapshot(record, self.config)

    def stream(self, record):
        return subprocess.Popen(self.command("relay") + [
            "-ExpectedProcessId", str(record["process_id"]), "-ExpectedStartedAt", record["started_at"],
            "-ExpectedWebSocket", record["webSocketDebuggerUrl"]],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    def closed_baseline(self):
        result = subprocess.run(self.command("baseline"), capture_output=True, text=True,
                                timeout=min(30, self.startup_timeout(30, "closed baseline inspection")))
        if result.returncode != 0:
            raise Blocked("Closed baseline inspection failed: " + result.stdout.strip() + result.stderr.strip())
        return validate_closed_baseline(json.loads(result.stdout.lstrip("\ufeff")), self.config)


class Relay(socketserver.ThreadingTCPServer):
    allow_reuse_address = False
    daemon_threads = True
    block_on_close = False

    def __init__(self, windows, record):
        self.windows, self.record = windows, validate_snapshot(record, windows.config)
        self.active = set()
        self.lock = threading.Lock()
        super().__init__(("127.0.0.1", 0), Pipe)

    def server_close(self):
        super().server_close()
        with self.lock:
            for child in self.active:
                child.terminate()


class Pipe(socketserver.BaseRequestHandler):
    def handle(self):
        child = None
        try:
            current = validate_snapshot(self.server.windows.snapshot(), self.server.windows.config)
            if incarnation(current) != incarnation(self.server.record):
                raise Blocked("Browser restarted; this relay cannot reuse an earlier WebSocket endpoint.")
            child = self.server.windows.stream(current)
            with self.server.lock:
                self.server.active.add(child)

            def upload():
                try:
                    while data := self.request.recv(65536):
                        child.stdin.write(data)
                        child.stdin.flush()
                except (OSError, ValueError):
                    pass
                finally:
                    try:
                        child.stdin.close()
                    except (OSError, ValueError):
                        pass

            threading.Thread(target=upload, daemon=True).start()
            while data := child.stdout.read1(65536):
                self.request.sendall(data)
        except (Blocked, OSError) as exc:
            print(json.dumps({"status": "BLOCKED", "detail": str(exc)}), file=sys.stderr, flush=True)
        finally:
            if child:
                child.terminate()
                child.wait(timeout=5)
                with self.server.lock:
                    self.server.active.discard(child)
                for stream in (child.stdin, child.stdout, child.stderr):
                    stream.close()
            try:
                self.request.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass


def discover_transport(server):
    # Prove that the WSL transport reaches the same current Windows discovery.
    connection = http.client.HTTPConnection(*server.server_address, timeout=server.windows.startup_timeout(15, "WSL relay /json/version discovery"))
    try:
        # Chrome derives the reported WebSocket authority from the HTTP Host.
        # Keep Windows-local discovery identical, then translate host/port below.
        connection.request("GET", "/json/version", headers={"Host": f"127.0.0.1:{server.windows.config['debugPort']}"})
        try:
            response = connection.getresponse()
        except TimeoutError as exc:
            raise Blocked("WSL relay /json/version response headers timed out before transport readiness.") from exc
        if response.status != 200:
            raise Blocked("Current /json/version is unavailable through WSL transport.")
        if connection.sock:
            connection.sock.settimeout(server.windows.startup_timeout(15, "WSL relay /json/version response body"))
        try:
            discovery = json.loads(response.read())
        except TimeoutError as exc:
            raise Blocked("WSL relay /json/version response body timed out before transport readiness.") from exc
    finally:
        connection.close()
    if (discovery.get("Browser") != "Chrome/" + server.record["version"] or
            discovery.get("webSocketDebuggerUrl") != server.record["webSocketDebuggerUrl"] or
            incarnation(validate_snapshot(server.windows.snapshot(), server.windows.config)) != incarnation(server.record)):
        raise Blocked("Browser discovery/process changed during transport validation.")
    path = urlsplit(discovery["webSocketDebuggerUrl"]).path
    return f"ws://127.0.0.1:{server.server_address[1]}{path}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, help="Runtime JSON: executable, profile, debugPort, optional exact version.")
    parser.add_argument("--powershell", required=True, help="Windows PowerShell executable reachable from WSL.")
    parser.add_argument("--launch", action="store_true", help="Start configured headed browser only if its persistent profile is inactive.")
    parser.add_argument("--readiness-ms", type=int, help="Caller-owned absolute startup budget; all runtime and transport validation share it.")
    args = parser.parse_args()
    if args.readiness_ms is not None and args.readiness_ms <= 0:
        parser.error("--readiness-ms must be positive")
    deadline = None if args.readiness_ms is None else time.monotonic() + args.readiness_ms / 1000
    server = None
    try:
        windows = Windows(args.config, args.powershell)
        windows.readiness_deadline = deadline
        record = windows.snapshot(launch=args.launch)
        server = Relay(windows, record)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        endpoint = discover_transport(server)
        windows.readiness_deadline = None  # Later connections retain their independent validation bound.
        print(json.dumps({**record, "cdp_endpoint": endpoint, "transport": f"WSL loopback -> Windows stdio TCP relay -> 127.0.0.1:{windows.config['debugPort']}"}), flush=True)
        threading.Event().wait()
    except KeyboardInterrupt:
        return 0
    except (Blocked, OSError, ValueError, subprocess.SubprocessError) as exc:
        print(json.dumps({"status": "BLOCKED", "detail": str(exc)}), flush=True)
        return 1
    finally:
        if server:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    sys.exit(main())
