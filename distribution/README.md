# Verification Platform distribution

This directory belongs to the single platform set identified by `resource-index.json`. It is not a separate package release. Installed resource paths are relative to this directory. Both frontend skills in `dist/frontends/` link to the same `dist/runtime/` host/CDP implementation and share evidence/reconciliation.

Install exact locked dependencies explicitly with `npm ci --ignore-scripts`; no browser download is required for the controlled distribution check. Runtime execution never installs dependencies. `npm test` runs only the synthetic ordinary Playwright Test/evidence/reporter compatibility smoke, not a browser experiment or consumer proof. Run from the unpacked distribution root. TypeScript declarations accompany public JS entries. The Python and PowerShell host assets are siblings under `dist/runtime/host/wsl-windows`; the shell native compatibility entry retains executable mode. Host execution still requires assigned external Windows runtime/configuration and Python/PowerShell prerequisites.

Supply the exact neutral binding and explicit root/index path to the `./resources` public export. Planning mode validates normative dependency closure; execution validates every indexed runtime/frontend resource. The validation CLI is `node dist/src/validation/cli.js` with JSON stdin. Result validation is `node dist/src/validation/result-cli.js`. There is no checkout/global-skill/latest fallback.

An offline snapshot retains the identical index bytes and all normative resources. It supports planning validation only; missing runtime/frontends cannot satisfy execution resolution. Evidence summary contracts preserve environment-specific capability limitations. Development observations, consumer artifacts, migration provenance and downstream overlays are excluded.

Release assembly and dry-run procedures are included in `distribution/RELEASE.md`; release-support commands run from canonical source. Synthetic fixture metadata is test-only and authorizes neither publication nor project adoption.
