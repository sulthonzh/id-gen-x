# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-06-19

### Fixed
- **Modulo bias in `randomInt()`** — Used `val % max` directly, which biases outputs when `max` doesn't evenly divide 2^32. Now uses rejection sampling to ensure uniform distribution.
- **ULID monotonicity bug** — When incrementing within the same millisecond, the random portion was replaced entirely by `BigInt(counter)`, producing predictable IDs (0, 1, 2...). Now increments the previous random value by the counter, preserving entropy while maintaining sort order.

### Added
- `--version` / `-V` CLI flag
- `prepublishOnly` script to prevent publishing broken packages
- `files` field in package.json for clean npm publishes
- CHANGELOG.md
- 3 real-world README examples (time-ordered DB keys, distributed job queue, URL-safe session tokens)
- Comparison table vs nanoid/uuid/ulid/flake-idgen

## [1.0.0] — 2026-06-15

### Added
- NanoID with custom alphabet, size, and prefix support
- UUID v4 (RFC 4122 compliant)
- UUID v7 (RFC 9562 timestamp-ordered, monotonic by default)
- ULID (Crockford Base32, lexicographically sortable)
- Snowflake IDs (Twitter-style distributed IDs with worker/datacenter)
- CUID2-style collision-resistant IDs
- Short ID generator with custom alphabet
- Sequential ID generator with prefix and padding
- Timestamp ID generator with custom radix encoding
- CLI tool (`idgen`) with decode commands and demo mode
- 41 tests covering all generators
