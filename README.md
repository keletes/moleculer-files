# moleculer-files

Moleculer mixin that handles file streams directly from services, over a pluggable storage driver.
Written in TypeScript, ships compiled output and type declarations.

## Install

Not on npm; installed from a git tag (compiled output is committed on the release commit, no build step, no auth: the repo is public).

```json
"moleculer-files": "git+https://github.com/keletes/moleculer-files.git#vX.Y.Z",
"moleculer": "^0.14.32"
```

`moleculer` is a peer dependency. Node >= 22. Pick a driver: `moleculer-files-gridfs` (MongoDB GridFS) or `moleculer-files-s3` (S3/MinIO).

## Usage

```ts
import FilesService from "moleculer-files";
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
| `get` [`GET /:id`] | `id` | readable stream; `FileNotFoundError` (404) when missing |
| `update` [`PUT /:id`] | stream as params, `ctx.meta.id` | stores a new revision |
| `remove` [`DELETE /:id`] | `id` | removed entry; `FileNotFoundError` (404) when missing |

Settings: `idField`, `fields`, `pageSize`, `maxPageSize`, `maxLimit`, `entityValidator`. Hooks: `afterConnected`, `entityRemoved`.
Overridable methods: `encodeID`, `decodeID`, `populateDocs`.

## Writing a driver

Implement `AdapterSchema` (exported): `init(broker, service)` and `connect()` are required, the rest is what the actions call
(`find`, `count`, `findById`, `save`, `updateById`, `removeById`, optional `disconnect`, `afterRetrieveTransformID`).
`findById` resolves to a readable stream, or a falsy value / an error with `code: 404` when the file does not exist;
`removeById` resolves to the removed entry or a falsy value.

## Changes in the TypeScript rewrite

Same public surface (default export, `AdapterSchema`, `QueryParams`, `FileNotFoundError`). Fixes: `entityRemoved` is now actually called on `remove`,
`fields`/`populate` are read from the call params, a driver error other than 404 is propagated by `get`, `moleculer-files` no longer depends on
`bluebird`/`lodash.*` (except `get`/`set`).
