# Contributing to AtlasTint

AtlasTint favors focused, evidence-backed changes that preserve geographic identity, local data integrity, accessibility, and map performance.

## Report a bug

Open an [issue](https://github.com/martonpaulo/atlas-tint/issues) and include what you did, what you
expected, what happened, the browser, and the viewport size — AtlasTint needs at least 1024 × 700 CSS
pixels and says so instead of mounting below that. Name the preset and the region's stable ID when
the map itself is wrong.

A boundary or a region's membership is usually not a bug: it follows the documented source versions
and the inclusion policy in the README. Say which documented policy you believe is being broken.

Report a vulnerability through GitHub's private channel described in [`SECURITY.md`](SECURITY.md),
never in a public issue. Never attach a personal progress export to an issue.

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

Run focused tests while working, then the complete gate before committing or opening a pull request:

```bash
pnpm validate
```

## Branches, commits and pull requests

- The owner commits validated work directly to `main`. Outside contributors work on a branch and
  open a pull request.
- Use English for code, documentation, and commit messages.
- Commit and pull request subjects follow [Conventional Commits](https://www.conventionalcommits.org/),
  one concern each, ending with the issue numbers they close: `feat(map): add the Spain insets (#41)`.
- A pull request that closes issues starts its body with one `Closes #<n>` line per issue, naming the
  same set as the title.
- Add a regression test for changed durable behavior when practical.
- Explain geographic inclusion-policy changes explicitly.
- Include screenshots only when they materially help review; do not include personal progress exports.

## Code of conduct

Be respectful and assume good faith. Behaviour that makes the project unpleasant for others is not
welcome, whatever its technical merit.

AtlasTint source code is licensed under the terms in [`LICENSE`](LICENSE). Only submit work you have the right to contribute, and preserve the independent geographic attribution requirements in [`NOTICE.md`](NOTICE.md).
