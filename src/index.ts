/*
 * moleculer-files
 * Copyright (c) 2019 Daniele Draganti
 * Largely inspired by MoleculerJS' Moleculer-DB (https://github.com/moleculerjs/moleculer-db)
 * MIT Licensed
 */

import get from "lodash.get";
import set from "lodash.set";
import { Errors } from "moleculer";
import type { Context, Service, ServiceBroker, ServiceSchema } from "moleculer";
import { FileNotFoundError } from "./errors";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg: { name: string; version: string } = require("../package.json");

export { FileNotFoundError };

const { ValidationError } = Errors;

export type FileId = number | string;

export type QueryParams = {
	id?: FileId;
	limit?: number | null;
	offset?: number | null;
	page?: number;
	pageSize?: number;
	sort?: string | string[];
	fields?: string | string[];
	populate?: string | string[];
	search?: string;
	searchFields?: string | string[];
	query?: Record<string, unknown>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[filter: string]: any;
};

/**
 * Contract of a storage driver (GridFS, S3, filesystem...). Assign an instance to the `adapter` property of the
 * service schema.
 */
export interface AdapterSchema {
	init(broker: ServiceBroker, service: Service): void;
	connect(): Promise<unknown>;
	disconnect?(): Promise<unknown> | void;
	/** Entries matching the (sanitized) params, as plain documents. */
	find?(params: QueryParams): Promise<unknown[]>;
	/** Readable stream of the file, or a falsy value when there is no such file. */
	findById?(id: FileId): Promise<NodeJS.ReadableStream | null | undefined>;
	count?(params: QueryParams): Promise<number | void>;
	/** Stores the stream; `meta` is the Moleculer `ctx.meta`. */
	save?(entity: NodeJS.ReadableStream, meta: Record<string, unknown>): Promise<unknown>;
	/** Stores a new revision of the file `id`. */
	updateById?(entity: NodeJS.ReadableStream, id: FileId): Promise<unknown>;
	/** Resolves to the removed entry, or a falsy value when there is no such file. */
	removeById?(id: FileId): Promise<unknown>;
	afterRetrieveTransformID?(document: unknown, idField: string): unknown;
}

export interface FilesSettings {
	/** Name of the ID field. */
	idField: string;
	/** Field filtering list; `null` does not filter. */
	fields: string[] | null;
	/** Default page size of `list`. */
	pageSize: number;
	/** Maximum page size of `list`. */
	maxPageSize: number;
	/** Maximum value of `limit` (-1: no limit). */
	maxLimit: number;
	/** Validator schema or function. */
	// eslint-disable-next-line @typescript-eslint/ban-types
	entityValidator: Record<string, unknown> | Function | null;
	[name: string]: unknown;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FilesMethods {
	connect(): Promise<void>;
	disconnect(): Promise<unknown> | void;
	sanitizeParams(ctx: Context<any, any>, params: QueryParams): QueryParams;
	entityChanged(type: string, json: unknown, ctx: Context<any, any>): Promise<unknown>;
	clearCache(): Promise<unknown>;
	transformDocuments(params: QueryParams, ctx: Context<any, any> | undefined, docs: unknown): Promise<any>;
	filterFields(doc: any, fields: string[] | string | null | undefined): any;
	authorizeFields(fields: string[] | string | null | undefined): any;
	validateEntity(entity: unknown): Promise<unknown>;
	encodeID(id: any): any;
	decodeID(id: any): any;
	populateDocs?(ctx: Context<any, any>, docs: any, populate: string | string[]): Promise<any>;
	_find(ctx: Context<any, any>, params: QueryParams): Promise<any>;
	_count(ctx: Context<any, any>, params: QueryParams): Promise<any>;
	_list(ctx: Context<any, any>, params: QueryParams): Promise<any>;
	_save(ctx: Context<any, any>, meta: Record<string, unknown>): Promise<any>;
	_get(ctx: Context<any, any>, params: QueryParams): Promise<NodeJS.ReadableStream>;
	_update(ctx: Context<any, any>, meta: Record<string, unknown>): Promise<any>;
	_remove(ctx: Context<any, any>, params: QueryParams): Promise<any>;
}

/** `this` of the handlers and methods of the mixin. */
export type FilesService = Service<FilesSettings> & FilesMethods & { adapter: AdapterSchema };

const splitList = (value: string): string[] => value.replace(/,/g, " ").split(" ");

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

/**
 * Service mixin to access file streams. Add it to `mixins` and set `adapter` (and, for the drivers that need
 * it, `collection`) in the service schema.
 */
const MoleculerFilesAdapter: ServiceSchema & ThisType<FilesService> = {
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
	} as FilesSettings,

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
			handler(ctx: Context<QueryParams>) {
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
			handler(ctx: Context<QueryParams>) {
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
			handler(ctx: Context<QueryParams>) {
				const params = this.sanitizeParams(ctx, ctx.params);
				return this._list(ctx, params);
			},
		},

		save: {
			rest: "POST /",
			handler(ctx: Context<NodeJS.ReadableStream, Record<string, unknown>>) {
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
			handler(ctx: Context<QueryParams>) {
				return this._get(ctx, ctx.params);
			},
		},

		update: {
			rest: "PUT /:id",
			handler(ctx: Context<NodeJS.ReadableStream, Record<string, unknown>>) {
				return this._update(ctx, ctx.meta);
			},
		},

		remove: {
			rest: "DELETE /:id",
			params: {
				id: { type: "any" },
			},
			handler(ctx: Context<QueryParams>) {
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
				} catch (err) {
					/* istanbul ignore next */
					this.logger.error("afterConnected error!", err);
				}
			}
		},

		disconnect() {
			if (typeof this.adapter.disconnect === "function") return this.adapter.disconnect();
		},

		/** Sanitize the context parameters of `find`, `count`, `list` and `remove`. */
		sanitizeParams(ctx, params) {
			const p: QueryParams = Object.assign({}, params);

			// Convert from string to number
			if (typeof p.limit === "string") p.limit = Number(p.limit);
			if (typeof p.offset === "string") p.offset = Number(p.offset);
			if (typeof p.page === "string") p.page = Number(p.page);
			if (typeof p.pageSize === "string") p.pageSize = Number(p.pageSize);

			if (typeof p.sort === "string") p.sort = splitList(p.sort);
			if (typeof p.fields === "string") p.fields = splitList(p.fields);
			if (typeof p.populate === "string") p.populate = splitList(p.populate);
			if (typeof p.searchFields === "string") p.searchFields = splitList(p.searchFields);

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
			if (this.schema[eventName] != null) return this.schema[eventName].call(this, json, ctx);
		},

		async clearCache() {
			this.broker.broadcast(`cache.clean.${this.fullName}`);
			if (this.broker.cacher) return this.broker.cacher.clean(`${this.fullName}.*`);
		},

		async transformDocuments(params, ctx, docs) {
			let isDoc = false;
			let list: any[];
			if (Array.isArray(docs)) {
				list = docs;
			} else if (docs !== null && typeof docs === "object") {
				isDoc = true;
				list = [docs];
			} else {
				return docs;
			}

			// Encode IDs and let the adapter apply its own ID field
			list = list.map((doc) => {
				doc[this.settings.idField] = this.encodeID(doc[this.settings.idField]);
				return this.adapter.afterRetrieveTransformID
					? this.adapter.afterRetrieveTransformID(doc, this.settings.idField)
					: doc;
			});

			if (ctx && params.populate && this.populateDocs) list = await this.populateDocs(ctx, list, params.populate);

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
					const v = get(doc, n);
					if (v !== undefined) set(res, n, v);
				});
				return res;
			}
			return doc;
		},

		authorizeFields(fields) {
			const allowed = this.settings.fields;
			if (allowed && allowed.length > 0) {
				let res: string[] = [];
				const requested: string[] = typeof fields === "string" ? fields.split(" ") : Array.isArray(fields) ? fields : [];
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

					const nested = allowed.filter((prop: string) => prop.indexOf(f + ".") !== -1);
					if (nested.length > 0) res = res.concat(nested);
				});
				return res;
			}
			return fields;
		},

		async validateEntity(entity) {
			const validator = this.settings.entityValidator;
			if (typeof validator !== "function") return entity;
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
			const docs = await this.adapter.find!(params);
			return this.transformDocuments(params, ctx, docs);
		},

		async _count(ctx, params) {
			// Remove pagination params
			if (params && params.limit) params.limit = null;
			if (params && params.offset) params.offset = null;
			return this.adapter.count!(params);
		},

		async _list(ctx, params) {
			const countParams: QueryParams = Object.assign({}, params);
			// Remove pagination params
			if (countParams.limit) countParams.limit = null;
			if (countParams.offset) countParams.offset = null;
			const [docs, total] = await Promise.all([this.adapter.find!(params), this.adapter.count!(countParams)]);
			const rows = await this.transformDocuments(params, ctx, docs);
			const count = Number(total);
			return {
				rows,
				total,
				page: params.page,
				pageSize: params.pageSize,
				totalPages: Math.floor((count + params.pageSize! - 1) / params.pageSize!),
			};
		},

		async _save(ctx, meta) {
			return this.adapter.save!(ctx.params as NodeJS.ReadableStream, meta);
		},

		async _get(ctx, params) {
			let file;
			try {
				file = await this.adapter.findById!(params.id!);
			} catch (err) {
				if ((err as { code?: unknown }).code == 404) throw new FileNotFoundError(String(params.id));
				throw err;
			}
			if (!file) throw new FileNotFoundError(String(params.id));
			return file;
		},

		async _update(ctx, meta) {
			let id: FileId | undefined;
			Object.keys(meta).forEach((prop) => {
				if (prop == "id" || prop == this.settings.idField) id = this.decodeID(meta[prop]);
				else throw new FileNotFoundError("No valid ID");
			});
			return this.adapter.updateById!(ctx.params as NodeJS.ReadableStream, id as FileId);
		},

		async _remove(ctx, params) {
			const id = this.decodeID(params.id);
			const doc = await this.adapter.removeById!(id);
			if (!doc) throw new FileNotFoundError(String(params.id));
			const json = await this.transformDocuments(params, ctx, doc);
			await this.entityChanged("removed", json, ctx);
			return json;
		},
	},

	created() {
		// Compatibility with < 0.4
		if (typeof this.settings.fields === "string") this.settings.fields = (this.settings.fields as string).split(" ");

		this.adapter = this.schema.adapter || null;
		if (!this.adapter) throw new Errors.ServiceSchemaError("Please set the store adapter in schema!", undefined);
		this.adapter.init(this.broker, this);

		// Transform the entity validation schema to a checker function
		const validator = this.settings.entityValidator;
		if (this.broker.validator && validator && typeof validator === "object") {
			const check = this.broker.validator.compile(validator);
			this.settings.entityValidator = async (entity: unknown) => {
				const res = check(entity);
				if (res !== true) throw new ValidationError("Entity validation error!", undefined as any, res as any);
			};
		}
	},

	/** Connects to the storage, retrying every second until it succeeds. */
	async started() {
		for (;;) {
			try {
				await this.connect();
				return;
			} catch (err) {
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

export default MoleculerFilesAdapter;
