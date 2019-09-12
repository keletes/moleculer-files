/*
 * moleculer-db
 * Copyright (c) 2019 MoleculerJS (https://github.com/moleculerjs/moleculer-db)
 * MIT Licensed
 */

"use strict";

const _ = require("lodash");
const Promise = require("bluebird");
const { MoleculerClientError, ValidationError } = require("moleculer").Errors;
const { FileNotFoundError } = require("./errors");
const pkg = require("./package.json");

/**
 * Service mixin to access file streams
 *
 * @name moleculer-files
 * @module Service
 */
module.exports = {
	// Must overwrite it
	name: "",

	// Service's metadata
	metadata: {
		$category: "files",
		$official: true,
		$name: pkg.name,
		$version: pkg.version,
		$repo: pkg.repository ? pkg.repository.url : null,
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
			handler(ctx) {
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
			handler(ctx) {
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
			handler(ctx) {
				let params = this.sanitizeParams(ctx, ctx.params);
				return this._list(ctx, params);
			}
		},

		save: {
			rest: "POST /",
			handler(ctx) {
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
					{ type: "number" },
					{ type: "array" }
				],
				mapping: { type: "boolean", optional: true }
			},
			async handler(ctx) {
				const stream = await this._get(ctx, ctx.params);
				return stream;
			}
		},

		update: {
			rest: "PUT /:id",
			handler(ctx) {
				let meta = ctx.meta;
				return this._update(ctx, meta);
			}
		},

		remove: {
			rest: "DELETE /:id",
			params: {
				id: { type: "any" }
			},
			handler(ctx) {
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
		connect() {
			return this.adapter.connect().then(() => {
				// Call an 'afterConnected' handler in schema
				if (_.isFunction(this.schema.afterConnected)) {
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
		disconnect() {
			if (_.isFunction(this.adapter.disconnect))
				return this.adapter.disconnect();
		},

		/**
		 * Sanitize context parameters at `find` action.
		 *
		 * @param {Context} ctx
		 * @param {any} origParams
		 * @returns {Promise}
		 */
		sanitizeParams(ctx, params) {
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

		entityChanged(type, json, ctx) {
			return this.clearCache().then(() => {
				const eventName = `entity${_.capitalize(type)}`;
				if (this.schema[eventName] != null) {
					return this.schema[eventName].call(this, json, ctx);
				}
			});
		},

		clearCache() {
			this.broker.broadcast(`cache.clean.${this.fullName}`);
			if (this.broker.cacher)
				return this.broker.cacher.clean(`${this.fullName}.*`);
			return Promise.resolve();
		},

		transformDocuments(ctx, params, docs) {
			let isDoc = false;
			if (!Array.isArray(docs)) {
				if (_.isObject(docs)) {
					isDoc = true;
					docs = [docs];
				}
				else
					return Promise.resolve(docs);
			}

			return Promise.resolve(docs)


				// Encode IDs
				map(doc => {
					doc[this.settings.idField] = this.encodeID(doc[this.settings.idField]);
					return doc;
				})
				// Apply idField
				.then(docs => docs.map(doc => this.adapter.afterRetrieveTransformID(doc, this.settings.idField)))
				// Populate
				.then(json => (ctx && params.populate) ? this.populateDocs(ctx, json, params.populate) : json)

			// TODO onTransformHook

				// Filter fields
				.then(json => {
					let fields = ctx && params.fields ? params.fields : this.settings.fields;

					// Compatibility with < 0.4
					/* istanbul ignore next */
					if (_.isString(fields))
						fields = fields.split(" ");

					// Authorize the requested fields
					const authFields = this.authorizeFields(fields);

					return json.map(item => this.filterFields(item, authFields));
				})

				// Return
				.then(json => isDoc ? json[0] : json);
		},

		filterFields(doc, fields) {
			// Apply field filter (support nested paths)
			if (Array.isArray(fields)) {
				let res = {};
				fields.forEach(n => {
					const v = _.get(doc, n);
					if (v !== undefined)
						_.set(res, n, v);
				});
				return res;
			}

			return doc;
		},

		authorizeFields(fields) {
			if (this.settings.fields && this.settings.fields.length > 0) {
				let res = [];
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

		validateEntity(entity) {
			if (!_.isFunction(this.settings.entityValidator))
				return Promise.resolve(entity);

			let entities = Array.isArray(entity) ? entity : [entity];
			return Promise.all(entities.map(entity => this.settings.entityValidator.call(this, entity))).then(() => entity);
		},

		encodeID(id) {
			return id;
		},

		decodeID(id) {
			return id;
		},

		_find(ctx, params) {
			return this.adapter.find(params)
				.then(docs => this.transformDocuments(ctx, params, docs));
		},

		_count(ctx, params) {
			// Remove pagination params
			if (params && params.limit)
				params.limit = null;
			if (params && params.offset)
				params.offset = null;
			return this.adapter.count(params);
		},

		_list(ctx, params) {
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
					.then(docs => {
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

		_save(ctx, meta) {
			let entity = ctx.params;
			return this.adapter.save(entity, meta);
		},

		async _get(ctx, params) {
  		const file = await this.adapter.findById(params.id);
  		if (file)
  		  return file;
  		throw new FileNotFoundError(params.id);
		},

		_update(ctx, meta) {
			let id;
			let sets = {};
			// Convert fields from params to "$set" update object
			Object.keys(meta).forEach(prop => {
				if (prop == "id" || prop == this.settings.idField)
					id = this.decodeID(params[prop]);
				else
					sets[prop] = params[prop];
			});
			return this.adapter.updateById(ctx.params, meta);
		},

		/**
		 * Remove an entity by ID.
		 *
		 * @methods
		 *
		 * @param {any} id - ID of entity.
		 * @returns {Number} Count of removed entities.
		 *
		 * @throws {FileNotFoundError} - 404 File not found
		 */
		_remove(ctx, params) {
			const id = this.decodeID(params.id);
			return this.adapter.removeById(id)
				.then(doc => {
					if (!doc)
						return Promise.reject(new FileNotFoundError(params.id));
					return this.transformDocuments(ctx, params, doc)
						.then(json => this.entityChanged("removed", json, ctx).then(() => json));
				});
		}
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {
		// Compatibility with < 0.4
		if (_.isString(this.settings.fields)) {
			this.settings.fields = this.settings.fields.split(" ");
		}

		if (!this.schema.adapter)
			this.adapter = null;
		else
			this.adapter = this.schema.adapter;

		this.adapter.init(this.broker, this);

		// Transform entity validation schema to checker function
		if (this.broker.validator && _.isObject(this.settings.entityValidator) && !_.isFunction(this.settings.entityValidator)) {
			const check = this.broker.validator.compile(this.settings.entityValidator);
			this.settings.entityValidator = entity => {
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
					this.connect().then(resolve).catch(err => {
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