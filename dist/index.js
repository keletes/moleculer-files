"use strict";
/*
 * moleculer-files
 * Copyright (c) 2019 Daniele Draganti
 * Largely inspired by MoleculerJS' Moleculer-DB (https://github.com/moleculerjs/moleculer-db)
 * MIT Licensed
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileNotFoundError = void 0;
const lodash_get_1 = __importDefault(require("lodash.get"));
const lodash_set_1 = __importDefault(require("lodash.set"));
const moleculer_1 = require("moleculer");
const errors_1 = require("./errors");
Object.defineProperty(exports, "FileNotFoundError", { enumerable: true, get: function () { return errors_1.FileNotFoundError; } });
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require("../package.json");
const { ValidationError } = moleculer_1.Errors;
const splitList = (value) => value.replace(/,/g, " ").split(" ");
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
/**
 * Service mixin to access file streams. Add it to `mixins` and set `adapter` (and, for the drivers that need
 * it, `collection`) in the service schema.
 */
const MoleculerFilesAdapter = {
    // Must be overwritten by the service
    name: "",
    metadata: {
        $category: "files",
        $official: true,
        $name: pkg.name,
        $version: pkg.version,
    },
    // Storage driver
    adapter: null,
    settings: {
        idField: "_id",
        fields: null,
        pageSize: 10,
        maxPageSize: 100,
        maxLimit: -1,
        entityValidator: null,
    },
    actions: {
        find: {
            cache: {
                keys: ["fields", "limit", "offset", "sort", "search", "searchFields", "query"],
            },
            params: {
                fields: [
                    { type: "string", optional: true },
                    { type: "array", optional: true, items: "string" },
                ],
                limit: { type: "number", integer: true, min: 0, optional: true, convert: true },
                offset: { type: "number", integer: true, min: 0, optional: true, convert: true },
                sort: { type: "string", optional: true },
                search: { type: "string", optional: true },
                searchFields: [
                    { type: "string", optional: true },
                    { type: "array", optional: true, items: "string" },
                ],
                query: { type: "object", optional: true },
            },
            handler(ctx) {
                const params = this.sanitizeParams(ctx, ctx.params);
                return this._find(ctx, params);
            },
        },
        count: {
            cache: {
                keys: ["search", "searchFields", "query"],
            },
            params: {
                search: { type: "string", optional: true },
                searchFields: [
                    { type: "string", optional: true },
                    { type: "array", optional: true, items: "string" },
                ],
                query: { type: "object", optional: true },
            },
            handler(ctx) {
                const params = this.sanitizeParams(ctx, ctx.params);
                return this._count(ctx, params);
            },
        },
        list: {
            cache: {
                keys: ["fields", "page", "pageSize", "sort", "search", "searchFields", "query"],
            },
            rest: "GET /",
            params: {
                fields: [
                    { type: "string", optional: true },
                    { type: "array", optional: true, items: "string" },
                ],
                page: { type: "number", integer: true, min: 1, optional: true, convert: true },
                pageSize: { type: "number", integer: true, min: 0, optional: true, convert: true },
                sort: { type: "string", optional: true },
                search: { type: "string", optional: true },
                searchFields: [
                    { type: "string", optional: true },
                    { type: "array", optional: true, items: "string" },
                ],
                query: { type: "object", optional: true },
            },
            handler(ctx) {
                const params = this.sanitizeParams(ctx, ctx.params);
                return this._list(ctx, params);
            },
        },
        save: {
            rest: "POST /",
            handler(ctx) {
                return this._save(ctx, ctx.meta);
            },
        },
        get: {
            cache: {
                keys: ["id", "fields", "mapping"],
            },
            rest: "GET /:id",
            params: {
                id: [{ type: "string" }, { type: "number" }],
            },
            handler(ctx) {
                return this._get(ctx, ctx.params);
            },
        },
        update: {
            rest: "PUT /:id",
            handler(ctx) {
                return this._update(ctx, ctx.meta);
            },
        },
        remove: {
            rest: "DELETE /:id",
            params: {
                id: { type: "any" },
            },
            handler(ctx) {
                const params = this.sanitizeParams(ctx, ctx.params);
                return this._remove(ctx, params);
            },
        },
    },
    methods: {
        /** Connect to the storage; runs `afterConnected` of the schema, if any. */
        async connect() {
            await this.adapter.connect();
            if (typeof this.schema.afterConnected === "function") {
                try {
                    return await this.schema.afterConnected.call(this);
                }
                catch (err) {
                    /* istanbul ignore next */
                    this.logger.error("afterConnected error!", err);
                }
            }
        },
        disconnect() {
            if (typeof this.adapter.disconnect === "function")
                return this.adapter.disconnect();
        },
        /** Sanitize the context parameters of `find`, `count`, `list` and `remove`. */
        sanitizeParams(ctx, params) {
            const p = Object.assign({}, params);
            // Convert from string to number
            if (typeof p.limit === "string")
                p.limit = Number(p.limit);
            if (typeof p.offset === "string")
                p.offset = Number(p.offset);
            if (typeof p.page === "string")
                p.page = Number(p.page);
            if (typeof p.pageSize === "string")
                p.pageSize = Number(p.pageSize);
            if (typeof p.sort === "string")
                p.sort = splitList(p.sort);
            if (typeof p.fields === "string")
                p.fields = splitList(p.fields);
            if (typeof p.populate === "string")
                p.populate = splitList(p.populate);
            if (typeof p.searchFields === "string")
                p.searchFields = splitList(p.searchFields);
            if (ctx.action?.name.endsWith(".list")) {
                let pageSize = p.pageSize || this.settings.pageSize;
                const page = p.page || 1;
                if (this.settings.maxPageSize > 0 && pageSize > this.settings.maxPageSize)
                    pageSize = this.settings.maxPageSize;
                p.pageSize = pageSize;
                p.page = page;
                p.limit = pageSize;
                p.offset = (page - 1) * pageSize;
            }
            if (this.settings.maxLimit > 0 && p.limit != null && p.limit > this.settings.maxLimit)
                p.limit = this.settings.maxLimit;
            return p;
        },
        /** Clears the cache and calls the `entity<Type>` handler of the schema, if any. */
        async entityChanged(type, json, ctx) {
            await this.clearCache();
            const eventName = `entity${capitalize(type)}`;
            if (this.schema[eventName] != null)
                return this.schema[eventName].call(this, json, ctx);
        },
        async clearCache() {
            this.broker.broadcast(`cache.clean.${this.fullName}`);
            if (this.broker.cacher)
                return this.broker.cacher.clean(`${this.fullName}.*`);
        },
        async transformDocuments(params, ctx, docs) {
            let isDoc = false;
            let list;
            if (Array.isArray(docs)) {
                list = docs;
            }
            else if (docs !== null && typeof docs === "object") {
                isDoc = true;
                list = [docs];
            }
            else {
                return docs;
            }
            // Encode IDs and let the adapter apply its own ID field
            list = list.map((doc) => {
                doc[this.settings.idField] = this.encodeID(doc[this.settings.idField]);
                return this.adapter.afterRetrieveTransformID
                    ? this.adapter.afterRetrieveTransformID(doc, this.settings.idField)
                    : doc;
            });
            if (ctx && params.populate && this.populateDocs)
                list = await this.populateDocs(ctx, list, params.populate);
            // Filter fields, only on the authorized ones
            const fields = ctx && params.fields ? params.fields : this.settings.fields;
            const authFields = this.authorizeFields(fields);
            list = list.map((item) => this.filterFields(item, authFields));
            return isDoc ? list[0] : list;
        },
        filterFields(doc, fields) {
            // Supports nested paths
            if (Array.isArray(fields)) {
                const res = {};
                fields.forEach((n) => {
                    const v = (0, lodash_get_1.default)(doc, n);
                    if (v !== undefined)
                        (0, lodash_set_1.default)(res, n, v);
                });
                return res;
            }
            return doc;
        },
        authorizeFields(fields) {
            const allowed = this.settings.fields;
            if (allowed && allowed.length > 0) {
                let res = [];
                const requested = typeof fields === "string" ? fields.split(" ") : Array.isArray(fields) ? fields : [];
                requested.forEach((f) => {
                    if (allowed.indexOf(f) !== -1) {
                        res.push(f);
                        return;
                    }
                    if (f.indexOf(".") !== -1) {
                        const parts = f.split(".");
                        while (parts.length > 1) {
                            parts.pop();
                            if (allowed.indexOf(parts.join(".")) !== -1) {
                                res.push(f);
                                break;
                            }
                        }
                    }
                    const nested = allowed.filter((prop) => prop.indexOf(f + ".") !== -1);
                    if (nested.length > 0)
                        res = res.concat(nested);
                });
                return res;
            }
            return fields;
        },
        async validateEntity(entity) {
            const validator = this.settings.entityValidator;
            if (typeof validator !== "function")
                return entity;
            const entities = Array.isArray(entity) ? entity : [entity];
            await Promise.all(entities.map((e) => validator.call(this, e)));
            return entity;
        },
        encodeID(id) {
            return id;
        },
        decodeID(id) {
            return id;
        },
        async _find(ctx, params) {
            const docs = await this.adapter.find(params);
            return this.transformDocuments(params, ctx, docs);
        },
        async _count(ctx, params) {
            // Remove pagination params
            if (params && params.limit)
                params.limit = null;
            if (params && params.offset)
                params.offset = null;
            return this.adapter.count(params);
        },
        async _list(ctx, params) {
            const countParams = Object.assign({}, params);
            // Remove pagination params
            if (countParams.limit)
                countParams.limit = null;
            if (countParams.offset)
                countParams.offset = null;
            const [docs, total] = await Promise.all([this.adapter.find(params), this.adapter.count(countParams)]);
            const rows = await this.transformDocuments(params, ctx, docs);
            const count = Number(total);
            return {
                rows,
                total,
                page: params.page,
                pageSize: params.pageSize,
                totalPages: Math.floor((count + params.pageSize - 1) / params.pageSize),
            };
        },
        async _save(ctx, meta) {
            return this.adapter.save(ctx.params, meta);
        },
        async _get(ctx, params) {
            let file;
            try {
                file = await this.adapter.findById(params.id);
            }
            catch (err) {
                if (err.code == 404)
                    throw new errors_1.FileNotFoundError(String(params.id));
                throw err;
            }
            if (!file)
                throw new errors_1.FileNotFoundError(String(params.id));
            return file;
        },
        async _update(ctx, meta) {
            let id;
            Object.keys(meta).forEach((prop) => {
                if (prop == "id" || prop == this.settings.idField)
                    id = this.decodeID(meta[prop]);
                else
                    throw new errors_1.FileNotFoundError("No valid ID");
            });
            return this.adapter.updateById(ctx.params, id);
        },
        async _remove(ctx, params) {
            const id = this.decodeID(params.id);
            const doc = await this.adapter.removeById(id);
            if (!doc)
                throw new errors_1.FileNotFoundError(String(params.id));
            const json = await this.transformDocuments(params, ctx, doc);
            await this.entityChanged("removed", json, ctx);
            return json;
        },
    },
    created() {
        // Compatibility with < 0.4
        if (typeof this.settings.fields === "string")
            this.settings.fields = this.settings.fields.split(" ");
        this.adapter = this.schema.adapter || null;
        if (!this.adapter)
            throw new moleculer_1.Errors.ServiceSchemaError("Please set the store adapter in schema!", undefined);
        this.adapter.init(this.broker, this);
        // Transform the entity validation schema to a checker function
        const validator = this.settings.entityValidator;
        if (this.broker.validator && validator && typeof validator === "object") {
            const check = this.broker.validator.compile(validator);
            this.settings.entityValidator = async (entity) => {
                const res = check(entity);
                if (res !== true)
                    throw new ValidationError("Entity validation error!", undefined, res);
            };
        }
    },
    /** Connects to the storage, retrying every second until it succeeds. */
    async started() {
        for (;;) {
            try {
                await this.connect();
                return;
            }
            catch (err) {
                this.logger.error("Connection error!", err);
                await new Promise((resolve) => setTimeout(resolve, 1000));
                this.logger.warn("Reconnecting...");
            }
        }
    },
    stopped() {
        return this.disconnect();
    },
};
exports.default = MoleculerFilesAdapter;
//# sourceMappingURL=index.js.map