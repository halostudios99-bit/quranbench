# Pending CI workflow

`ci.yml` in this directory is the project's CI pipeline: lint, types, unit tests,
a Playwright e2e job against real Postgres and Redis, the backup round-trip test,
and a Lighthouse job asserting the design-system budgets.

It lives here rather than in `.github/workflows/` for one reason: the GitHub token
used to create this repository was issued without the `workflow` scope, and GitHub
refuses any push that creates or updates a file under `.github/workflows/` without
it. Rather than drop the CI configuration, or leave the repository unpushed and the
code on two machines, it is parked one directory across.

**To enable it:**

```bash
gh auth refresh -h github.com -s workflow
git mv .github/workflows-pending/ci.yml .github/workflows/ci.yml
git rm .github/workflows-pending/README.md
git commit -m "ci: enable the workflow"
git push
```

Nothing else needs to change — the file is unmodified.
