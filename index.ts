/*
 * moleculer-files
 * Copyright (c) 2019 Daniele Draganti
 Largely inspired by MoleculerJS' Moleculer-DB (https://github.com/moleculerjs/moleculer-db)
 * MIT Licensed
 */

"use strict";

import capitalize from 'lodash.capitalize';
import isFunction from 'lodash.isfunction';
import isObject from 'lodash.isobject';
import isString from 'lodash.isstring';
import get from 'lodash.get';
import set from 'lodash.set';
import Promise from "bluebird";
import { Context, Errors, ServiceSchema } from "moleculer";
import { FileNotFoundError } from "./errors";
import pkg from "./package.json";

export type QueryParams = {
	id?: number | string;
	limit?: number,
	offset?: number,
	page?: number,
	pageSize?: number,
	sort?: string | string[],
	fields?: string | string[],
	populate?: string | string[],
	searchFields?: string | string[],
}

export interface AdapterSchema {
	connect?: Function;
	disconnect?: Function;
	find?: (params: QueryParams) => Promise<any[]>;
	findById?: (id: QueryParams['id']) => Promise<WritableStream>;
	count?: (params: QueryParams) => Promise<number>;
	save?: (entity: ReadableStream, meta: any) => Promise<any>;
	updateById?: (entity: ReadableStream, meta: any) => Promise<any>;
	removeById?: (id: QueryParams['id']) => Promise<any[]>;
	afterRetrieveTransformID?: (document: any, idField: string) => Promise<any>;
};

interface AdapterParams {};
interface AdapterMeta {};

const { ValidationError } = Errors;

interface AdapterProperties {
	name: string;
	metadata: Record<any, any>;
	adapter: AdapterSchema;
}

interface AdapterSettings {
	idField: string;
	fields?: string[];
	pageSize: number;
	maxPageSize: number;
	maxLimit: number;
	entityValidator: Object | Function;
}

/**
 * Service mixin to access file streams
 *
 * @name moleculer-files
 * @module Service
 */
const MoleculerFilesAdapter: ServiceSchema<AdapterSettings> & AdapterProperties = {
	// Must overwrite it
	name: "",

	// Service's metadata
	metadata: {
		$category: "files",
		$official: true,
		$name: pkg.name,
		$version: pkg.version,
	},

	// Store adapter
	adapter: null,

	/**
	 * Default settings
	 */
	settings: {
		/** @type {String} Name of ID field. */
		idField: "_id",

		/** @type {Array<String>?} Field filtering list. It must be an `Array`. If the value is `null` or `undefined` doesn't filter the fields of entities. */
		fields: null,

		/** @type {Number} Default page size in `list` action. */
		pageSize: 10,

		/** @type {Number} Maximum page size in `list` action. */
		maxPageSize: 100,

		/** @type {Number} Maximum value of limit in `find` action. Default: `-1` (no limit) */
		maxLimit: -1,

		/** @type {Object|Function} Validator schema or a function to validate the incoming entity in `create` & 'insert' actions. */
		entityValidator: null
	},

	/**
	 * Actions
	 */
	actions: {

		find: {
			cache: {
				keys: ["fields", "limit", "offset", "sort", "search", "searchFields", "query"]
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
				query: { type: "object", optional: true }
			},
			handler(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>): ReadableStream {
				let params = this.sanitizeParams(ctx, ctx.params);
				return this._find(ctx, params);
			}
		},

		count: {
			cache: {
				keys: ["search", "searchFields", "query"]
			},
			params: {
				search: { type: "string", optional: true },
				searchFields: [
					{ type: "string", optional: true },
					{ type: "array", optional: true, items: "string" },
				],
				query: { type: "object", optional: true }
			},
			handler(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>): number {
				let params = this.sanitizeParams(ctx, ctx.params);
				return this._count(ctx, params);
			}
		},

		list: {
			cache: {
				keys: ["fields", "page", "pageSize", "sort", "search", "searchFields", "query"]
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
				query: { type: "object", optional: true }
			},
			handler(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>) {
				let params = this.sanitizeParams(ctx, ctx.params);
				return this._list(ctx, params);
			}
		},

		save: {
			rest: "POST /",
			handler(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>) {
				let meta = ctx.meta;
				return this._save(ctx, meta);
			}
		},

		get: {
			cache: {
				keys: ["id", "fields", "mapping"]
			},
			rest: "GET /:id",
			params: {
				id: [
					{ type: "string" },
					{ type: "number" }
				]
			},
			async handler(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>) {
				const stream = await this._get(ctx, ctx.params);
				return stream;
			}
		},

		update: {
			rest: "PUT /:id",
			handler(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>) {
				let meta = ctx.meta;
				return this._update(ctx, meta);
			}
		},

		remove: {
			rest: "DELETE /:id",
			params: {
				id: { type: "any" }
			},
			handler(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>) {
				let params = this.sanitizeParams(ctx, ctx.params);
				return this._remove(ctx, params);
			}
		}
	},

	/**
	 * Methods
	 */
	methods: {

		/**
		 * Connect to database.
		 */
		connect(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>) {
			return this.adapter.connect().then(() => {
				// Call an 'afterConnected' handler in schema
				if (isFunction(this.schema.afterConnected)) {
					try {
						return this.schema.afterConnected.call(this);
					} catch(err) {
						/* istanbul ignore next */
						this.logger.error("afterConnected error!", err);
					}
				}
			});
		},

		/**
		 * Disconnect from database.
		 */
		disconnect(this: typeof MoleculerFilesAdapter) {
			if (isFunction(this.adapter.disconnect))
				return this.adapter.disconnect();
		},

		/**
		 * Sanitize context parameters at `find` action.
		 *
		 * @param {Context<AdapterParams, AdapterMeta>} ctx
		 * @param {any} params
		 * @returns {Promise}
		 */
		sanitizeParams(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>, params: QueryParams) {
			let p = Object.assign({}, params);

			// Convert from string to number
			if (typeof(p.limit) === "string")
				p.limit = Number(p.limit);
			if (typeof(p.offset) === "string")
				p.offset = Number(p.offset);
			if (typeof(p.page) === "string")
				p.page = Number(p.page);
			if (typeof(p.pageSize) === "string")
				p.pageSize = Number(p.pageSize);

			if (typeof(p.sort) === "string")
				p.sort = p.sort.replace(/,/g, " ").split(" ");

			if (typeof(p.fields) === "string")
				p.fields = p.fields.replace(/,/g, " ").split(" ");

			if (typeof(p.populate) === "string")
				p.populate = p.populate.replace(/,/g, " ").split(" ");

			if (typeof(p.searchFields) === "string")
				p.searchFields = p.searchFields.replace(/,/g, " ").split(" ");

			if (ctx.action.name.endsWith(".list")) {
				// Default `pageSize`
				if (!p.pageSize)
					p.pageSize = this.settings.pageSize;

				// Default `page`
				if (!p.page)
					p.page = 1;

				// Limit the `pageSize`
				if (this.settings.maxPageSize > 0 && p.pageSize > this.settings.maxPageSize)
					p.pageSize = this.settings.maxPageSize;

				// Calculate the limit & offset from page & pageSize
				p.limit = p.pageSize;
				p.offset = (p.page - 1) * p.pageSize;
			}
			// Limit the `limit`
			if (this.settings.maxLimit > 0 && p.limit > this.settings.maxLimit)
				p.limit = this.settings.maxLimit;

			return p;
		},

		entityChanged(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>, type: string, json: any) {
			return this.clearCache().then(() => {
				const eventName = `entity${capitalize(type)}`;
				if (this.schema[eventName] != null) {
					return this.schema[eventName].call(this, json, ctx);
				}
			});
		},

		clearCache(this: typeof MoleculerFilesAdapter) {
			this.broker.broadcast(`cache.clean.${this.fullName}`);
			if (this.broker.cacher)
				return this.broker.cacher.clean(`${this.fullName}.*`);
			return Promise.resolve();
		},

		async transformDocuments(this: typeof MoleculerFilesAdapter, params: QueryParams, ctx: Context<AdapterParams, AdapterMeta>, docs: any[] | {}) {
			let isDoc = false;
			if (!Array.isArray(docs)) {
				if (isObject(docs)) {
					isDoc = true;
					docs = [docs];
				}
				else
					return Promise.resolve(docs);
			}

			return Promise.resolve(docs as any[])


				// Encode IDs
				.map(doc => {
					doc[this.settings.idField] = this.encodeID(doc[this.settings.idField]);
					return doc;
				})
				// Apply idField
				.then(docs => docs.map(doc => this.adapter.afterRetrieveTransformID?.(doc, this.settings.idField)))
				// Populate
				.then((json: any) => (ctx && params.populate) ? this.populateDocs(ctx, json, params.populate) : json)

			// TODO onTransformHook

				// Filter fields
				.then(json => {
					let fields = ctx && params.fields ? params.fields : this.settings.fields;

					// Compatibility with < 0.4
					/* istanbul ignore next */
					if (isString(fields))
						fields = fields.split(" ");

					// Authorize the requested fields
					const authFields = this.authorizeFields(fields);

					return json.map((item: any) => this.filterFields(item, authFields));
				})

				// Return
				.then(json => isDoc ? json[0] : json);
		},

		filterFields(doc: any, fields: string) {
			// Apply field filter (support nested paths)
			if (Array.isArray(fields)) {
				let res = {};
				fields.forEach(n => {
					const v = get(doc, n);
					if (v !== undefined)
						set(res, n, v);
				});
				return res;
			}

			return doc;
		},

		authorizeFields(this: typeof MoleculerFilesAdapter, fields) {
			if (this.settings.fields && this.settings.fields.length > 0) {
				let res: AdapterSettings['fields'] = [];
				if (Array.isArray(fields) && fields.length > 0) {
					fields.forEach(f => {
						if (this.settings.fields.indexOf(f) !== -1) {
							res.push(f);
							return;
						}

						if (f.indexOf(".") !== -1) {
							let parts = f.split(".");
							while (parts.length > 1) {
								parts.pop();
								if (this.settings.fields.indexOf(parts.join(".")) !== -1) {
									res.push(f);
									break;
								}
							}
						}

						let nestedFields = this.settings.fields.filter(prop => prop.indexOf(f + ".") !== -1);
						if (nestedFields.length > 0) {
							res = res.concat(nestedFields);
						}
					});
					//return _.intersection(f, this.settings.fields);
				}
				return res;
			}

			return fields;
		},

		async validateEntity(this: typeof MoleculerFilesAdapter, entity) {
			if (!isFunction(this.settings.entityValidator))
				return Promise.resolve(entity);

			let entities = Array.isArray(entity) ? entity : [entity];
			return Promise.all(entities.map(entity => (this.settings.entityValidator as Function).call(this, entity))).then(() => entity);
		},

		encodeID(id) {
			return id;
		},

		decodeID(id) {
			return id;
		},

		async _find(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>, params: QueryParams) {
			return this.adapter.find(params)
				.then(docs => this.transformDocuments(ctx, params, docs));
		},

		async _count(this: typeof MoleculerFilesAdapter, params: QueryParams) {
			// Remove pagination params
			if (params && params.limit)
				params.limit = null;
			if (params && params.offset)
				params.offset = null;
			return this.adapter.count(params);
		},

		async _list(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>, params: QueryParams) {
			let countParams = Object.assign({}, params);
			// Remove pagination params
			if (countParams && countParams.limit)
				countParams.limit = null;
			if (countParams && countParams.offset)
				countParams.offset = null;
			return Promise.all([
				// Get rows
				this.adapter.find(params),
				// Get count of all rows
				this.adapter.count(countParams)
			]).then(res => {
				return this.transformDocuments(ctx, params, res[0])
					.then((docs: any) => {
						return {
							// Rows
							rows: docs,
							// Total rows
							total: res[1],
							// Page
							page: params.page,
							// Page size
							pageSize: params.pageSize,
							// Total pages
							totalPages: Math.floor((res[1] + params.pageSize - 1) / params.pageSize)
						};
					});
			});
		},

		async _save(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>, meta: {}) {
			let entity: WritableStream = ctx.params as WritableStream;
			return this.adapter.save(entity, meta);
		},

		async _get(this: typeof MoleculerFilesAdapter, params: QueryParams) {
  		const file = await this.adapter.findById(params.id);
  		if (file)
  		  return file;
  		throw new FileNotFoundError(String(params.id));
		},

		async _update(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>, meta: Record<string, any>) {
			let id;
			Object.keys(meta).forEach(prop => {
				if (prop == "id" || prop == this.settings.idField)
					id = this.decodeID(meta[prop]);
				else
					throw new FileNotFoundError("No valid ID");
			});
			return this.adapter.updateById(ctx.params as WritableStream, id);
		},

		async _remove(this: typeof MoleculerFilesAdapter, ctx: Context<AdapterParams, AdapterMeta>, params: QueryParams) {
			const id = this.decodeID(params.id);
			return this.adapter.removeById(id)
				.then(doc => {
					if (!doc)
						return Promise.reject(new FileNotFoundError(String(params.id)));
					return this.transformDocuments(ctx, params, doc)
						.then((json: {}) => this.entityChanged("removed", json, ctx).then(() => json));
				});
		}
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {
		// Compatibility with < 0.4
		if (isString(this.settings.fields)) {
			this.settings.fields = this.settings.fields.split(" ");
		}

		if (!this.schema.adapter)
			this.adapter = null;
		else
			this.adapter = this.schema.adapter;

		this.adapter.init(this.broker, this);

		// Transform entity validation schema to checker function
		if (this.broker.validator && isObject(this.settings.entityValidator) && !isFunction(this.settings.entityValidator)) {
			const check = this.broker.validator.compile(this.settings.entityValidator);
			this.settings.entityValidator = (entity: any) => {
				const res = check(entity);
				if (res === true)
					return Promise.resolve();
				else
					return Promise.reject(new ValidationError("Entity validation error!", null, res));
			};
		}

	},

	/**
	 * Service started lifecycle event handler
	 */
	started() {
		if (this.adapter) {
			return new Promise(resolve => {
				let connecting = () => {
					this.connect().then(resolve).catch((err: Error) => {
						this.logger.error("Connection error!", err);
						setTimeout(() => {
							this.logger.warn("Reconnecting...");
							connecting();
						}, 1000);
					});
				};

				connecting();
			});
		}

		/* istanbul ignore next */
		return Promise.reject(new Error("Please set the store adapter in schema!"));
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() {
		if (this.adapter)
			return this.disconnect();
	}
};
