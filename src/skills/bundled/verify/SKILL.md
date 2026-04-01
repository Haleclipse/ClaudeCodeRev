---
description: Verify a code change does what it should by running the app.
---

# Verify

Verify that a code change works correctly by running the application and checking the expected behavior.

## How to use

1. Make your code change
2. Run `/verify` to check that the change works as expected
3. The verification will run the app and check for expected behavior

## What it checks

- The application starts without errors
- The changed functionality works as expected
- No regressions in related functionality

## Examples

See the examples directory for language-specific verification patterns:
- `examples/cli.md` — CLI application verification
- `examples/server.md` — Server application verification
