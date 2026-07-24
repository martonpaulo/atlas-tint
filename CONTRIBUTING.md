# Contributing to AtlasTint

AtlasTint favors focused, evidence-backed changes that preserve geographic identity, local data integrity, accessibility, and map performance.

## Before changing code

1. Search for an existing issue, component, domain rule, or test covering the behavior.
2. Keep preset-specific policy in a manifest or preset module rather than branching the product core on known preset IDs.
3. Document authoritative sources, versions, checksums, and attribution for geographic data changes.
4. Avoid new runtime dependencies unless the browser platform and current stack cannot solve the problem cleanly.

## Local setup

Use a current Node.js LTS release and pnpm 11:

```bash
pnpm install
pnpm dev:web
```

Run focused tests while working, then the complete release gate before requesting review:

```bash
pnpm validate
```

## Pull requests

- Use English for code, documentation, and commit messages.
- Keep commits focused and use Conventional Commit subjects.
- Add a regression test for changed durable behavior when practical.
- Explain geographic inclusion-policy changes explicitly.
- Include screenshots only when they materially help review; do not include personal progress exports.

AtlasTint does not currently publish a source-code license. Only submit work you have the right to contribute, and do not assume that public availability grants reuse rights.
