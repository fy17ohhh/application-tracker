# Contributing

Thanks for your interest in contributing to ApplyBoard.

Bug reports, feature ideas, documentation improvements, and pull requests are all welcomed.

## Before you start

- Check the existing issues and discussions to avoid duplicate work.
- Keep the scope focused; small, well-tested changes are easier to review.
- Prefer clear commit messages and incremental updates.

## Development setup

### Prerequisites

- Node.js 18+
- pnpm 9+

### Install dependencies

```bash
corepack pnpm install
```

### Start the extension locally

```bash
corepack pnpm dev
```

### Run checks

```bash
corepack pnpm lint
corepack pnpm test
corepack pnpm typecheck
# corepack pnpm test:e2e
```

### Build the extension

```bash
corepack pnpm build
```

## Workflow

1. Fork the repository and create a feature branch.
2. Make a focused change with tests or validation when applicable.
3. Run the relevant checks locally.
4. Open a pull request with a clear summary and context.

## Coding guidelines

- Follow the existing TypeScript and React patterns used in the repo.
- Prefer small, readable functions and minimal scope creep.
- Keep browser-extension behavior explicit and user-safe.
- Avoid introducing remote data collection or cloud sync without a clear design decision.

## Privacy and data handling

This project is designed around local-first storage. Keep user data handling explicit and privacy-conscious.

- Do not add automatic cloud sync for the current version.
- Avoid logging sensitive data or secrets.
- Preserve the user consent model around reading the active page.

## Reporting bugs

When filing a bug report, include:

- Browser and version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Relevant logs or screenshots if available

## Pull request checklist

Before submitting a PR, confirm that:

- The change is scoped and easy to review
- Code passes the relevant checks
- Documentation is updated when behavior changes
- The PR description explains the problem and solution
