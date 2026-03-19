# Release Checklist

Use this checklist before tagging or publishing a release.

## Code and quality

- [ ] `pnpm install` succeeds on a clean environment
- [ ] `pnpm run build` succeeds
- [ ] Key user flows verified manually (query, preview, history, API key manager)
- [ ] No debug-only code left

## Security and secrets

- [ ] No real keys in repository files
- [ ] `EM_API_KEY.local` is ignored and not tracked
- [ ] Recent commits scanned for accidental secret exposure
- [ ] If a key was exposed, it has been rotated

## Docs and metadata

- [ ] `README.md` matches current behavior and structure
- [ ] `QUICKSTART.md` steps are valid
- [ ] `LICENSE` and copyright are correct
- [ ] If user-facing behavior changed, release notes updated

## Open-source readiness

- [ ] `CONTRIBUTING.md` is up to date
- [ ] `CODE_OF_CONDUCT.md` is present
- [ ] `SECURITY.md` reporting process is valid
- [ ] `.github/workflows/ci.yml` is green on target commit

## Release output

- [ ] Tag name and version are consistent
- [ ] Changelog/release notes include highlights and breaking changes
- [ ] Post-release smoke test completed
