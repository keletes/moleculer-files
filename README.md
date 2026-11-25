# @keletes/moleculer-files

Moleculer mixin that handles file streams directly from services, over a pluggable storage driver.
Written in TypeScript, ships compiled output and type declarations.

## Install

Published to GitHub Packages as `@keletes/moleculer-files`. Point the scope at the registry (`@keletes:registry=https://npm.pkg.github.com`) and authenticate with a token that can read packages.

```json
"@keletes/moleculer-files": "^X.Y.Z",
"moleculer": "^0.14.32"
```

`moleculer` is a peer dependency. Node >= 22. Pick a driver: `moleculer-files-gridfs` (MongoDB GridFS) or `moleculer-files-s3` (S3/MinIO).

## Usage

```ts
import FilesService from "@keletes/moleculer-files";
import GridFs from "moleculer-files-gridfs";

export default {
	name: "cad",
	mixins: [FilesService],
	adapter: new GridFs(process.env.MONGO_SERVER!, {}),
	collection: "cad", // bucket / collection name, driver specific
};
```

Actions (all available through `broker.call`, `rest` routes in brackets):

| Action | Params | Result |
|---|---|---|
| `find` | `fields`, `limit`, `offset`, `sort`, `query`, driver filters | array of entries |
| `count` | `query`, driver filters | number |
| `list` [`GET /`] | `page`, `pageSize`, ... | `{ rows, total, page, pageSize, totalPages }` |
| `save` [`POST /`] | the file as a readable stream; `ctx.meta` carries `id`/`filename`/`contentType`... | driver specific |
| `get` [`GET /:id`] | `id` | readable stream (never cached); `FileNotFoundError` (404) when missing. When the driver has `stat`, the response `meta` carries `filename`, `contentType`, `size`, `metadata` |
| `update` [`PUT /:id`] | stream as params, `ctx.meta.id` | stores a new revision |
| `remove` [`DELETE /:id`] | `id` | removed entry; `FileNotFoundError` (404) when missing |

Settings: `idField`, `fields`, `pageSize`, `maxPageSize`, `maxLimit`, `entityValidator`. Hooks: `afterConnected`, `entityRemoved`.
Service methods (not actions, nothing is exposed):

- `this.findFiles({ prefix?, filter? }, { concurrency = 8 } = {})` resolves to `[{ id, filename, contentType, size, metadata }]`. It lists with the driver's `find({ prefix })`, then calls the driver's `stat(id)` on each entry (`id` = the entry's `idField`), at most `concurrency` at a time. `filter(details)` is an optional predicate run after `stat`. A file that disappears in between (`stat` resolves to a falsy value or fails with `code: 404`) is skipped. Throws when the driver has no `stat`.
- `this.removeFiles(ids, { concurrency = 8 } = {})` calls the driver's `removeById` for each id, at most `concurrency` at a time, clears the cache and resolves to the ids that existed.

Overridable methods: `encodeID`, `decodeID`, `populateDocs`.

## Writing a driver

Implement `AdapterSchema` (exported): `init(broker, service)` and `connect()` are required, the rest is what the actions call
(`find` (it may honour a `prefix` param, which `findFiles` passes), `count`, `findById`, `save`, `updateById`, `removeById`, optional `stat`, `disconnect`, `afterRetrieveTransformID`).
`findById` resolves to a readable stream, or a falsy value / an error with `code: 404` when the file does not exist;
`stat(id)` (optional) resolves to `{ filename, contentType?, size?, metadata? }` (`metadata` = the custom metadata stored at save) or a falsy value; `get` copies it into `ctx.meta`.
`removeById` resolves to the removed entry or a falsy value.

## Changes in the TypeScript rewrite

Same public surface (default export, `AdapterSchema`, `QueryParams`, `FileNotFoundError`). Fixes: `entityRemoved` is now actually called on `remove`,
`fields`/`populate` are read from the call params, a driver error other than 404 is propagated by `get`, `moleculer-files` no longer depends on
`bluebird`/`lodash.*` (except `get`/`set`).
