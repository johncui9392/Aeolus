# Contributing to Aeolus

Thanks for your interest in contributing.

## Development Setup

1. Install dependencies:

```powershell
pnpm install
```

2. Configure API keys (as needed):
- **Eastmoney / MX skills:** `EM_API_KEY.local` from `EM_API_KEY.local.example`
- **Wind skills:** `WIND_API_KEY.local` from `WIND_API_KEY.local.example` — see [docs/WIND_DATA_SOURCE.md](docs/WIND_DATA_SOURCE.md)

3. Start dev environment:

```powershell
pnpm run dev
```

## Branch and PR Guidelines

- Create feature branches from `main`
- Keep PRs focused and small
- Include clear PR description:
  - What changed
  - Why it changed
  - How to test

## Code Style

- Keep changes consistent with existing style
- Prefer small, readable functions
- Avoid introducing breaking behavior without discussion

## Validation Before PR

Run:

```powershell
pnpm run build
```

If your change affects backend behavior, include manual verification steps in the PR.

## Commit Messages

Use concise, descriptive messages. Example:
- `update API key modal interaction`
- `fix xlsx preview parser fallback`

## Security

Do not commit secrets, API keys, or local env files.
See `SECURITY.md` for vulnerability reporting.
