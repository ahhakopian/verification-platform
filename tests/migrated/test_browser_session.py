import contextlib
import http.client
import importlib.util
import io
import json
from pathlib import Path
import socket
import socketserver
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("browser_session", ROOT / "runtime/host/wsl-windows" / "browser-session.py")
runtime = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runtime)


CONFIG = {"executable": r"C:\BrowserFixture\browser.exe", "profile": r"C:\RuntimeFixture\profile", "debugPort": 9317, "version": "123.4.5.6"}


def record(pid=123, ws_id="current"):
    return {"status": "ok", "binary": CONFIG["executable"], "version": CONFIG["version"],
            "profile": CONFIG["profile"],
            "process_id": pid, "started_at": f"start-{pid}",
            "webSocketDebuggerUrl": f"ws://127.0.0.1:9317/devtools/browser/{ws_id}"}


# Synthetic TCP fixture: HTTP discovery then a binary duplex stream. No browser.
class Target(socketserver.BaseRequestHandler):
    def handle(self):
        data = b""
        while b"\r\n\r\n" not in data:
            chunk = self.request.recv(4096)
            if not chunk:
                return
            data += chunk
        if data.startswith(b"GET /json/version "):
            host = next(line.split(b": ", 1)[1].decode() for line in data.split(b"\r\n") if line.startswith(b"Host: "))
            ws = self.server.windows.record["webSocketDebuggerUrl"].replace("127.0.0.1:9317", host)
            body = json.dumps({"Browser": "Chrome/" + CONFIG["version"],
                               "webSocketDebuggerUrl": ws}).encode()
            self.request.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)
        else:
            self.request.sendall(b"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n")
            while data := self.request.recv(65536):
                self.request.sendall(data)


class FixtureWindows(runtime.Windows):
    def __init__(self):
        self.config = CONFIG
        self.record = record()
        self.calls = 0
        self.streams = []
        self.target = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Target)
        self.target.daemon_threads = True
        self.target.windows = self
        threading.Thread(target=self.target.serve_forever, daemon=True).start()

    def snapshot(self, launch=False):
        self.calls += 1
        return dict(self.record)

    def stream(self, current):
        self.streams.append(current)
        # Exercise the actual WSL relay's subprocess pipe path with a local TCP
        # byte forwarder standing in for the Windows stdio process.
        code = """import socket,sys,threading
s=socket.create_connection(('127.0.0.1',int(sys.argv[1])))
def upload():
 try:
  while data:=sys.stdin.buffer.read1(65536): s.sendall(data)
  s.shutdown(socket.SHUT_WR)
 except OSError: pass
threading.Thread(target=upload,daemon=True).start()
while data:=s.recv(65536):
 sys.stdout.buffer.write(data);sys.stdout.buffer.flush()
"""
        return subprocess.Popen([sys.executable, "-c", code, str(self.target.server_address[1])],
                                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


class BrowserSessionTests(unittest.TestCase):
    def test_closed_baseline_requires_explicit_absence_not_attach_error_text(self):
        absent = {"status": "ok", "state": "STOPPED", "binary": CONFIG["executable"],
                  "profile": CONFIG["profile"], "version": CONFIG["version"],
                  "profileProcessCount": 0, "listenerCount": 0}
        self.assertEqual(runtime.validate_closed_baseline(absent, CONFIG), absent)
        self.assertEqual(runtime.validate_closed_baseline(record() | {"state": "RUNNING"}, CONFIG)["state"], "RUNNING")
        for changed in ({"status": "BLOCKED", "detail": "Debugging listener is absent or ambiguous."},
                        {"listenerCount": 1}, {"profileProcessCount": 2}, {"listenerCount": False},
                        {"profile": "unknown"}, {"state": "unknown"}):
            with self.subTest(changed=changed), self.assertRaises(runtime.Blocked):
                runtime.validate_closed_baseline(absent | changed, CONFIG)

    def test_closed_baseline_inspection_never_ensures_or_launches(self):
        windows = object.__new__(runtime.Windows)
        windows.config, windows.config_path, windows.powershell, windows.script = CONFIG, "fixture.json", "fixture", "fixture.ps1"
        absent = {"status": "ok", "state": "STOPPED", "binary": CONFIG["executable"], "profile": CONFIG["profile"],
                  "version": CONFIG["version"], "profileProcessCount": 0, "listenerCount": 0}
        with patch.object(runtime.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, json.dumps(absent), "")) as run:
            self.assertEqual(windows.closed_baseline()["state"], "STOPPED")
        self.assertEqual(run.call_args.args[0][-1], "baseline")

    def test_runtime_values_come_only_from_configuration(self):
        self.assertEqual(runtime.validate_snapshot(record(), CONFIG), record())
        for changed in ({"binary": r"C:\OtherFixture\browser.exe"}, {"version": "1.2.3.4"},
                        {"profile": r"C:\OtherFixture\profile"}):
            with self.subTest(changed=changed), self.assertRaises(runtime.Blocked):
                runtime.validate_snapshot(record() | changed, CONFIG)
        alternate = CONFIG | {"executable": r"D:\Different\runtime.exe", "profile": r"D:\Profile", "debugPort": 9321}
        observed = record() | {"binary": alternate["executable"], "profile": alternate["profile"],
                               "webSocketDebuggerUrl": "ws://127.0.0.1:9321/devtools/browser/another"}
        self.assertEqual(runtime.validate_snapshot(observed, alternate), observed)
        no_version = {key: value for key, value in CONFIG.items() if key != "version"}
        self.assertEqual(runtime.validate_snapshot(record() | {"version": "7.8.9.0"}, no_version)["version"], "7.8.9.0")

    def test_config_requires_explicit_valid_runtime_values(self):
        for config in ({}, CONFIG | {"debugPort": True}, CONFIG | {"debugPort": 0},
                       CONFIG | {"executable": "relative.exe"}, CONFIG | {"profile": ""},
                       CONFIG | {"version": ""}):
            with self.subTest(config=config), self.assertRaises(runtime.Blocked):
                runtime.validate_config(config)

    def test_discovery_requires_complete_current_browser_websocket(self):
        for ws in ("", "ws://192.0.2.1:9317/devtools/browser", "ws://127.0.0.1:9317/devtools/browser",
                   "ws://127.0.0.1:9317/devtools/browser/", "ws://localhost:9320/devtools/browser/old"):
            with self.subTest(ws=ws), self.assertRaises(runtime.Blocked):
                runtime.validate_snapshot(record() | {"webSocketDebuggerUrl": ws}, CONFIG)

    def test_windows_inspect_and_launch_use_current_discovery_only(self):
        windows = object.__new__(runtime.Windows)
        windows.config = CONFIG
        windows.config_path = "fixture.json"
        windows.powershell = "fixture-powershell"
        windows.script = "fixture.ps1"
        snapshots = [record(123, "first"), record(456, "fresh")]
        with patch.object(runtime.subprocess, "run", side_effect=[
                subprocess.CompletedProcess([], 0, json.dumps(x), "") for x in snapshots]) as run:
            first = windows.snapshot()
            second = windows.snapshot(launch=True)
        self.assertNotEqual(first["webSocketDebuggerUrl"], second["webSocketDebuggerUrl"])
        self.assertEqual(run.call_args_list[0].args[0][-1], "inspect")
        self.assertEqual(run.call_args_list[1].args[0][-1], "ensure")

    def test_generic_attach_reattach_fresh_discovery_stale_rejection_and_cleanup(self):
        windows = FixtureWindows()
        relay = runtime.Relay(windows, windows.snapshot())
        threading.Thread(target=relay.serve_forever, daemon=True).start()
        try:
            endpoint = runtime.discover_transport(relay)
            self.assertTrue(endpoint.endswith("/devtools/browser/current"))
            with socket.create_connection(relay.server_address, timeout=5) as connection:
                connection.sendall(b"GET /devtools/browser/current HTTP/1.1\r\nUpgrade: websocket\r\n\r\n")
                self.assertIn(b"101 Switching", connection.recv(4096))
                binary = b"\x00\xff\xfebytes\x80" * 2000
                connection.sendall(binary)
                received = b""
                while len(received) < len(binary):
                    received += connection.recv(65536)
                self.assertEqual(received, binary)
            # Driver-only loss: re-attach against the same valid process/relay.
            with socket.create_connection(relay.server_address, timeout=5) as connection:
                connection.sendall(b"GET /devtools/browser/current HTTP/1.1\r\nUpgrade: websocket\r\n\r\n")
                self.assertIn(b"101 Switching", connection.recv(4096))
            streams_before = len(windows.streams)
            windows.record = record(456, "fresh")
            with contextlib.redirect_stderr(io.StringIO()) as errors:
                with socket.create_connection(relay.server_address, timeout=5) as connection:
                    connection.sendall(b"GET /json/version HTTP/1.1\r\n\r\n")
                    self.assertEqual(connection.recv(4096), b"")
                self.assertIn("BLOCKED", errors.getvalue())
            self.assertEqual(len(windows.streams), streams_before)
            # A new task setup obtains the fresh process endpoint.
            fresh = runtime.Relay(windows, windows.snapshot())
            threading.Thread(target=fresh.serve_forever, daemon=True).start()
            try:
                self.assertTrue(runtime.discover_transport(fresh).endswith("/devtools/browser/fresh"))
                # Process loss: only the freshly discovered relay can re-attach.
                with socket.create_connection(fresh.server_address, timeout=5) as connection:
                    connection.sendall(b"GET /devtools/browser/fresh HTTP/1.1\r\nUpgrade: websocket\r\n\r\n")
                    self.assertIn(b"101 Switching", connection.recv(4096))
            finally:
                fresh.shutdown()
                fresh.server_close()
        finally:
            relay.shutdown()
            relay.server_close()
            windows.target.shutdown()
            windows.target.server_close()

    def test_discovery_change_during_setup_blocks(self):
        server = type("Server", (), {"server_address": ("127.0.0.1", 1), "record": record()})()
        server.windows = type("Windows", (), {"config": CONFIG, "snapshot": lambda self: record(456, "fresh"), "startup_timeout": lambda self, default, phase: default})()
        response = type("Response", (), {"status": 200, "read": lambda self: json.dumps(
            {"Browser": "Chrome/" + CONFIG["version"], "webSocketDebuggerUrl": record()["webSocketDebuggerUrl"]}).encode()})()
        with patch.object(runtime.http.client, "HTTPConnection") as connection:
            connection.return_value.getresponse.return_value = response
            with self.assertRaises(runtime.Blocked):
                runtime.discover_transport(server)

    def test_transport_uses_remaining_caller_budget_instead_of_hidden_fifteen_seconds(self):
        windows = object.__new__(runtime.Windows)
        windows.config = CONFIG
        windows.readiness_deadline = 120.0
        windows.snapshot = lambda: record()
        server = type("Server", (), {"server_address": ("127.0.0.1", 1), "record": record(), "windows": windows})()
        discovery = {"Browser": "Chrome/" + CONFIG["version"], "webSocketDebuggerUrl": record()["webSocketDebuggerUrl"]}
        response = type("Response", (), {"status": 200, "read": lambda self: json.dumps(discovery).encode()})()
        class TimedConnection:
            def __init__(self, *address, timeout):
                self.timeout = timeout
                self.sock = None
            def request(self, *args, **kwargs): pass
            def getresponse(self):
                # Required connection validation takes 16s: exceeds the old
                # hidden 15s but fits the caller's remaining startup budget.
                if self.timeout < 16:
                    raise TimeoutError("timed out")
                return response
            def close(self): pass
        with patch.object(runtime.time, "monotonic", return_value=20.0), patch.object(runtime.http.client, "HTTPConnection", TimedConnection):
            self.assertTrue(runtime.discover_transport(server).endswith("/devtools/browser/current"))
            windows.readiness_deadline = None
            with self.assertRaisesRegex(runtime.Blocked, "response headers timed out"):
                runtime.discover_transport(server)
        with patch.object(runtime.time, "monotonic", return_value=121.0):
            windows.readiness_deadline = 120.0
            with self.assertRaisesRegex(runtime.Blocked, "deadline exhausted before WSL relay"):
                runtime.discover_transport(server)

    def test_inspection_caps_intrinsic_timeout_by_absolute_startup_remainder(self):
        windows = object.__new__(runtime.Windows)
        windows.config = CONFIG
        windows.config_path, windows.powershell, windows.script = "fixture", "fixture", "fixture"
        windows.readiness_deadline = 120.0
        with patch.object(runtime.time, "monotonic", return_value=110.0), patch.object(runtime.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, json.dumps(record()), "")) as run:
            windows.snapshot()
            self.assertEqual(run.call_args.kwargs["timeout"], 10.0)
        with patch.object(runtime.time, "monotonic", return_value=120.0), patch.object(runtime.subprocess, "run") as run:
            with self.assertRaisesRegex(runtime.Blocked, "deadline exhausted before Windows runtime inspection"):
                windows.snapshot()
            run.assert_not_called()

    def test_cleanup_preserves_profile_site_extension_state(self):
        with tempfile.TemporaryDirectory() as directory:
            profile = Path(directory) / "fixture-profile"
            profile.mkdir(parents=True)
            files = [profile / name for name in ("Cookies", "Preferences", "extension-state")]
            for file in files:
                file.write_bytes(b"persistent")
            relay = runtime.Relay(type("Windows", (), {"config": CONFIG})(), record())
            relay.server_close()
            self.assertEqual([file.read_bytes() for file in files], [b"persistent"] * 3)


if __name__ == "__main__":
    unittest.main()
