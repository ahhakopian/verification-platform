# Playwright CDP connection timeout

The CDP connection timeout used by `attach --cdp` is configurable:

- Environment variable: `PLAYWRIGHT_MCP_CDP_TIMEOUT`.
- Equivalent config setting: `browser.cdpTimeout` in the file supplied through `--config`.
- Values are milliseconds: `600000` is 10 minutes; `0` disables the CDP connection timeout.
- There is no direct `attach` timeout CLI flag.

Attachment example (use the current endpoint from assigned runtime discovery):

```bash
PLAYWRIGHT_MCP_CDP_TIMEOUT=600000 \
playwright-cli -s='<task-session>' attach --cdp='<CDP_ENDPOINT>'
```

For explicit, justified escalation only, the timeout can be disabled:

```bash
PLAYWRIGHT_MCP_CDP_TIMEOUT=0 \
playwright-cli -s='<task-session>' attach --cdp='<CDP_ENDPOINT>'
```

Equivalent config form in the file supplied through `--config`:

```json
{"browser":{"cdpTimeout":600000}}
```

Use `0` instead of `600000` only when explicitly required. Infinite timeout is not the normal default.
