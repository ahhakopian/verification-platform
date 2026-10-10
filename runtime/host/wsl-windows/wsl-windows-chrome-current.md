# Windows runtime and WSL transport

Use only for the existing headed Windows Chrome runtime backend. The caller supplies an external JSON file containing `executable`, `profile`, `debugPort` and optional exact `version`. Executable and profile are absolute Windows paths; the profile must already exist. The PowerShell executable reachable from WSL is a separate `--powershell` argument. No browser binary, installed version, persistent profile or debug port is built into the harness.

`browser-session.py` uses `browser-runtime.ps1` to inspect or, with assigned `--launch`, reuse/launch that runtime. It rejects wrong binary/profile/version, headless roots, missing/ambiguous listener ownership and conflicting profile processes. Launch is serialized and occurs only with inactive profile and free configured port. It never repairs an unhealthy runtime, deletes profile state, updates software or changes Windows networking.

Fresh `/json/version` discovery binds the complete browser WebSocket URL to process ID/start time. A WSL loopback port allocated for this run relays raw TCP via Windows PowerShell stdio to the configured Windows loopback debug port. Discovery is checked again through the relay; every new connection revalidates incarnation. No CDP client is implemented by this relay.

Keep its execution handle until final detach. Restart invalidates the relay and targets: stop the owned old relay, inspect/discover afresh and attach with the new emitted `cdp_endpoint`. Never persist that endpoint for later runs. A directly reachable caller-supplied CDP route can be used after current discovery is checked; do not assume WSL localhost is Windows localhost.

At final cleanup detach first and stop only the owned transport. The runtime and persistent profile remain intact. Transport or semantic-control failure returns a limitation; it does not authorize switching runtime, native pointer fallback, or additional scenario work.

BrowserPreflight reuses this acquisition/ensure implementation and the same assigned `launch` flag. With authorized launch, call ensure directly: healthy exact Chrome is PASS; a successful observed `launched: true` plus fresh CDP attachment is RECOVERED. Wrong/conflicting/unhealthy runtime or disallowed launch is BLOCKED. The caller obtains any known required WSL → Windows escalation before invoking this helper/runtime; the library grants no host permission.

Recovery is setup before ENVIRONMENT READY. During an atomic proof, lost browser/target identity is reported using existing proof uncertainty rules; do not transparently launch, attach a replacement or reacquire a different target. An intentional proof restart remains an explicit proof action. Cleanup still preserves Chrome and the persistent profile.
