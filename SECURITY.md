# Security Policy

## Supported Versions

Security fixes are applied to the latest `main` branch.

## Reporting a Vulnerability

If you discover a security vulnerability:

1. Do **not** open a public issue with exploit details.
2. Provide a private report including:
   - Description of the issue
   - Reproduction steps
   - Potential impact
   - Suggested fix (optional)

Until a dedicated security contact is configured, report via your private maintainer channel.

## Secret Handling

- Never commit `EM_API_KEY.local` or real API keys.
- If a key is exposed, rotate it immediately.
- Use placeholder values like `your_em_api_key` in docs and examples.
