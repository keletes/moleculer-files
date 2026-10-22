# moleculer-files

`moleculer-files`: Moleculer mixin that exposes file streams (`find`, `count`, `list`, `save`, `get`, `update`, `remove` actions) over a pluggable storage driver. Drivers live in separate repos: `moleculer-files-gridfs`, `moleculer-files-s3` (used by the fleet) and `moleculer-files-filesystem` (not used, not modernised). Design and usage are in `README.md`.

## Shape of this repo (like `@keletes/moleculer-db-adapter-mongo`)

- **No npm registry.** Consumers install from a git tag: `"moleculer-files": "git+https://github.com/keletes/moleculer-files.git#vX.Y.Z"`. Public repo, so no `PACKAGES_READ_PAT` anywhere.
- **`dist/` is built and committed by the release commit only** (`@semantic-release/exec` runs `yarn build`, `@semantic-release/git` force-adds `dist/**`). `dist/` is gitignored on purpose: do NOT commit it in PRs.
- `yarn.lock` is committed (CI installs with `--frozen-lockfile`). `moleculer` is a peer dependency.
- Package name stays unscoped (`moleculer-files`): the services depend on it under that name.

## Commands

```
yarn verify   # typecheck + lint
yarn test     # jest; in-memory storage driver, no external infrastructure
yarn build    # tsc -> dist/
```

CI (`verify.yml`): `verify` (typecheck, lint, build, audit) and `test` are the required checks on `master`.

## Gotchas

- Moleculer merges the service schema when it creates the service, so `service.adapter` is a copy of the instance in the schema: in tests reach the driver through the service, not through the instance you passed.
- The mixin's `this` type is `FilesService`; drivers implement `AdapterSchema` (exported), `init` and `connect` are required.

## Releases: trunk-based, Conventional Commits

**Every PR title must follow [Conventional Commits](https://www.conventionalcommits.org/)** (`.github/workflows/pr-title.yml`). Squash-merge uses the PR title as the `master` commit message, which `tag.yml` feeds to `semantic-release`:

| Prefix | Effect |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` or `BREAKING CHANGE:` footer | major |
| `chore:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `ci:`, `build:` | no release |

On a release, semantic-release builds `dist/`, commits `package.json` + `dist/` as `chore(release): X.Y.Z [skip ci]`, tags `vX.Y.Z` and publishes a GitHub Release. **Never bump the version or push a `v*` tag by hand.**

`tag.yml` pushes through the branch ruleset with the GitHub App token (org secrets `DEPLOY_APP_ID`, `DEPLOY_APP_PRIVATE_KEY`; the app is a bypass actor of the ruleset and must be installed on this repo). Node 22 is required for `yarn install`.

## Branching: check merge status first

*Always* check whether the current branch has already been merged into `master` before starting work: `git fetch origin`, `git branch -r --merged origin/master`, `git cherry origin/master`, and (squash merges) `gh pr list --head <branch> --state merged`. If merged, branch from an up-to-date `origin/master`. Every change goes through a feature branch and PR; `master` is protected. After a PR merges, check `master` out and fast-forward it before starting anything else.
