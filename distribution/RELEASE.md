# Candidate assembly and immutable release procedure

The canonical repository is the dedicated `ahhakopian/verification-platform` repository, intended to be checked out locally at `~/tools/verification-platform/`. The local `~/tools/` directory is only a parent of independently versioned repositories and does not imply repository nesting. Do not assume the GitHub repository already exists without current Git/GitHub evidence. Contracts, runtime, host assets and both frontends share one ordinary repository-scoped `vMAJOR.MINOR.PATCH` release identity. Downstream SpecKit overlays remain in their separate repositories and are excluded from the platform release. Never substitute a branch, `latest`, or arbitrary development checkout.

## Source identity and preparation

Establish the real canonical GitHub origin, exact HEAD, clean repository and existing tag/release inventory. Current workspace metadata cannot establish these facts. Synthetic fixture runs explicitly use `--fixture-only`, record `sourceVerified: false` and `published: false`, and never authorize publication/adoption. Implementation is release-ready except for external publication identity; real source identity must be obtained before assembling a publishable candidate.

Prepare generic provider implementation versions for the selected exact platform tag. Use the locked dependency set, pinned TypeScript and a compatible Node runtime; explicitly run `npm ci --ignore-scripts` and `npm run build` in canonical platform source. Build starts with a clean generated directory. No browser download or runtime experiment is part of release assembly. Check source status/commit after preparation. Commit prepared canonical source through the existing repository process before real assembly.

Create an identity JSON with only `repository`, immutable `tag`, and 40-character `sourceCommit`. Run from any directory:

```sh
node <canonical-platform>/distribution/assemble.mjs identity.json empty-candidate
node <canonical-platform>/distribution/check.mjs full empty-candidate exact-binding.json
node <canonical-platform>/distribution/check.mjs snapshot empty-candidate exact-binding.json empty-offline
node <canonical-platform>/distribution/check.mjs normative empty-offline exact-binding.json
node <canonical-platform>/distribution/release-dry-run.mjs empty-candidate exact-binding.json unused-asset-prefix
```

Construct the neutral exact binding using the index SHA-256 and its declared repository/tag/commit and public normative resource IDs. Assembly rejects identity mismatch, unprepared provider versions, dirty platform source or nonempty output. Exact source metadata is never inferred from an unrelated checkout. Test mode is explicit on assembly and dry-run only.

## Published set and verification

Assembly includes contracts/schemas, canonical built runtime and declaration entries, canonical WSL→Windows assets, both frontend skills/assets/templates, exact package/lock identities, consumer instructions and bounded synthetic distribution smoke fixtures. It excludes development progress/provenance, personal paths, empirical raw runtime observations, consumer plans/results/evidence, caches and downstream repositories.

Two recorded deterministic staging transformations adapt only packaging surfaces: package scripts expose the shipped synthetic smoke rather than source build commands; the shipped ordinary synthetic fixture imports the canonical built runtime. Capability descriptors reference a maintained sanitized normative evidence summary. Original development evidence remains unchanged. No helper/schema/reconciliation implementation is duplicated between frontends.

Index bytes bind every published resource's digest, format, kind, dependencies and public entry. Exact binding validation rejects missing/mutated/mixed-release content. Full checking additionally verifies native compatibility executable mode. Offline snapshots retain identical full index bytes plus all normative resources; execution remains unavailable. Explicit consumer dependency preparation uses the exact lockfile and is never an execution fallback. Run `npm test` from the relocated/unpacked candidate and check public imports/declarations/frontend links before publication. Release tar enumerates only indexed files plus the index; normalized ordering/mtime/owner/group make archive bytes reproducible and preserve executable bits. No node_modules, unindexed files or live artifacts enter release assets.

## Later publication — separate authorization required

Dry-run emits a reproducible tar.gz, an exact `unused-asset-prefix.resource-index.json` asset, and reviewable release metadata naming the versioned archive and exact resource-index asset with SHA-256 digests. It creates no tag, release or remote side effect and refuses replacement of existing assets. Check the canonical remote tag and GitHub release inventory again immediately before separately authorized publication. Create the `vMAJOR.MINOR.PATCH` tag at the exact prepared commit and publish the matching assets once. Never move tags, replace assets or reuse a version; changed bytes require a new platform version. Installed frontend paths are configuration, not identity. Real consumer binding, upgrades and activation remain separately authorized governed work.
