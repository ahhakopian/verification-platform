"""One-time, digest-recorded import. Refuses to overwrite an existing migration."""
import hashlib
import json
from pathlib import Path
import shutil
import sys

source = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parents[1]
record = root / "distribution/import-provenance.json"
if record.exists():
    raise SystemExit("Already imported; maintain canonical platform files now")
mapping = {
    "scripts/extension-action.cjs": "runtime/cdp/extension-action.cjs",
    **{f"scripts/{name}": f"runtime/host/wsl-windows/{name}" for name in
       ("browser-runtime.ps1", "browser-session.py", "native-ui.ps1", "native-ui")},
    "SKILL.md": "frontends/browser-verification/SKILL.md",
    "assets/wsl-windows-chrome-current.md": "runtime/host/wsl-windows/wsl-windows-chrome-current.md",
    "assets/playwright-cdp-timeout.md": "frontends/browser-verification/assets/playwright-cdp-timeout.md",
    **{f"tests/{name}": f"tests/migrated/{name}" for name in
       ("extension-action.test.cjs", "test_browser_session.py", "config-regression.ps1", "runtime-regression.ps1", "native-regression.ps1", "test_contract.py")},
}
files = []
for old, new in mapping.items():
    src, dst = source / old, root / new
    if dst.exists():
        raise SystemExit(f"Destination already exists: {new}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    files.append({"source": old, "destination": new,
                  "sha256": hashlib.sha256(src.read_bytes()).hexdigest(),
                  "executable": bool(src.stat().st_mode & 0o111)})
record.write_text(json.dumps({"schemaVersion": 1, "origin": "installed browser-verification bundle (not canonical repository)",
                             "sourceLocation": str(source), "files": files}, indent=2) + "\n")
