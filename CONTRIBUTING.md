# Contributing to Prestige

Thanks for considering a contribution. This project is maintained by [Inceptyon Labs](https://github.com/inceptyon-labs) and welcomes pull requests, bug reports, and feature ideas.

By participating, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

Prestige is a Tauri 2 desktop app with a React 19 + Vite frontend. You'll need:

- [Bun](https://bun.sh) (for the JS toolchain — package manager + test runner)
- [Rust](https://rustup.rs) stable (≥ 1.77.2) with `cargo`
- The platform prerequisites Tauri itself needs — see <https://tauri.app/start/prerequisites/>

Clone and install:

```bash
git clone https://github.com/inceptyon-labs/prestige.git
cd prestige
bun install
```

Activate the versioned git hooks once per clone (runs gitleaks on every commit, blocking accidental secrets):

```bash
git config core.hooksPath .githooks
```

You'll also want `gitleaks` available on your PATH so the hook can run:

```bash
brew install gitleaks    # macOS
# Linux: https://github.com/gitleaks/gitleaks/releases
```

## Running locally

```bash
bun run dev          # browser build (no Tauri features)
bun run tauri:dev    # full desktop build with native shell + AI integrations
```

## Tests

```bash
bun test
```

Vitest with React Testing Library. Tests live alongside the code they cover (`*.test.ts(x)` files).

## Commit style

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Examples:

- `feat: add Samsung Galaxy S25 Ultra frame`
- `fix: race condition in deleteProject`
- `refactor: extract snap guides into their own module`
- `docs: clarify multi-device export behaviour`

Keep commits focused — one logical change per commit.

## Pull requests

1. Open an issue first for anything non-trivial. Drive-by drafts are welcome for small fixes.
2. Branch from `master`. Branch names: `feat/...`, `fix/...`, `chore/...`.
3. Make sure `bun test` passes and `bunx tsc --noEmit` is clean before pushing.
4. Reference the issue in the PR body (`Closes #123`).
5. Keep PRs small. If you're touching > 5 files for unrelated reasons, split it.

## Reporting bugs

Use the [bug report issue template](.github/ISSUE_TEMPLATE/bug_report.md). Include:

- What you expected vs. what happened
- Steps to reproduce
- OS + Prestige version (or commit SHA)
- Console output / screenshots when relevant

## License

Contributions are accepted under the project's license (AGPL-3.0-or-later). By submitting a pull request, you agree your contributions are licensed under those terms.
