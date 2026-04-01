# Claude Code 2.1.88 Rebuild

Recovered source tree of `@anthropic-ai/claude-code@2.1.88`, rebuilt from the published npm package's sourcemap.

### *What you read with your own eyes becomes yours. What AIGC generates always belongs to someone else. — To a restless world.*

For personal study and learning purposes only.

## How it was recovered

1. **Sourcemap extraction** — 1902 TypeScript source files extracted from `cli.js.map`'s `sourcesContent`
2. **React Compiler reversal** — 552 files further restored to pre-compilation originals via embedded inline sourcemaps
3. **Stub generation** — 142 feature-gated modules (DCE'd from the public build) auto-stubbed from import analysis
4. **Resource recovery** — 29 skill docs fetched from platform.claude.com, 4 classifier prompts inferred from usage
5. **Internal packages** — `@ant/*` packages restored from sourcemap, native addons paired with vendor binaries

## Setup

```bash
bun install
bun run gen-stubs    # generate stub files for missing modules
bun run build        # production build → dist/cli.js
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Run source directly with Bun |
| `bun run build` | Production build (minified, feature flags off) |
| `bun run build:dev` | Dev build (all features on, no minify) |
| `bun run build:sourcemap` | Build with sourcemap |
| `bun run start` | Run built `dist/cli.js` with Node |
| `bun run typecheck` | TypeScript type checking |
| `bun run gen-stubs` | Generate stub files for missing modules |
| `bun run gen-stubs:dry` | Preview what stubs would be generated |
| `bun run gen-stubs:clean` | Remove all generated stubs |

## Project Structure

```
rebuild/
├── src/                    # Recovered source (1902 files + 142 stubs)
├── packages/               # Local packages
│   ├── @ant/               # Anthropic internal packages (from sourcemap)
│   ├── @anthropic-ai/      # claude-agent-sdk (from npm tgz)
│   ├── audio-capture/      # Native audio module + platform binaries
│   ├── color-diff-napi/    # TS port of native color-diff
│   ├── modifiers-napi/     # TS port of native key modifiers
│   └── ripgrep/            # rg binaries (6 platforms)
├── scripts/
│   ├── build.ts            # Bun bundler with feature flags + MACRO define
│   └── gen-stubs.ts        # Auto-generate stubs for missing modules
├── patches/
│   └── commander@13.0.0.patch  # Loose short-flag parsing (matches original)
├── bunfig.toml             # Bun runtime config (MACRO defines for dev)
└── Analysis/               # Build analysis documentation
```

## License

Original source is Copyright (c) Anthropic PBC. See the published package for license terms.
