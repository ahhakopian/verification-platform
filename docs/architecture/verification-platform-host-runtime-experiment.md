# Verification Platform host-runtime experiment

Date: 2026-10-07. **Final verdict: PASS for the tested lifecycle paths.**

## Scope and result

The experiment checked that an assigned caller-owned Windows Chrome instance remained available after an ordinary Playwright client detached, after clean teardown of an owned WSL relay, and after abnormal termination of an owned relay. Each path was followed by fresh runtime discovery and a read-only Playwright attachment. The same browser process incarnation and page targets remained available across the tested lifecycle transitions.

The experiment used the existing browser-verification helpers and ordinary Node/Playwright CDP attachment. It did not change platform runtime implementation. The borrowed browser, profile and pages were not closed, navigated or mutated. Only experiment-owned relay/client processes were stopped.

## Findings

- Clean relay teardown did not terminate the caller-owned browser. Fresh runtime inspection, target discovery, relay setup and a new Playwright read succeeded afterward.
- Abnormal termination of an owned relay disconnected its attached client. The relay's stream ended, and fresh runtime inspection, target discovery, relay setup and a new Playwright read succeeded afterward.
- The tested helper path preserved the observed process/profile association and page-target identities across both lifecycle paths. This was not a byte-for-byte profile audit or an authentication/content test.
- The result applies only to the tested assigned Windows Chrome instance and lifecycle paths. It does not establish behavior for other host topologies or browser versions, the separate Playwright `browser.close()` API, or native UIA cancellation.

Detailed local process, profile, endpoint and target identifiers are not included in this public documentation. They were observations for that run, not platform defaults or reusable repository identity.
