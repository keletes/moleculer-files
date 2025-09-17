'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_capitalize_1 = __importDefault(require("lodash.capitalize"));
const lodash_isfunction_1 = __importDefault(require("lodash.isfunction"));
const lodash_isobject_1 = __importDefault(require("lodash.isobject"));
const lodash_isstring_1 = __importDefault(require("lodash.isstring"));
const lodash_get_1 = __importDefault(require("lodash.get"));
const lodash_set_1 = __importDefault(require("lodash.set"));
const bluebird_1 = __importDefault(require("bluebird"));
const moleculer_1 = require("moleculer");
const errors_1 = require("./errors");
const package_json_1 = __importDefault(require("../package.json"));
const { ValidationError } = moleculer_1.Errors;
const MoleculerFilesAdapter = {
    name: '',
    metadata: {
        $category: 'files',
        $official: true,
        $name: package_json_1.default.name,
        $version: package_json_1.default.version,
    },
    adapter: null,
    settings: {
        idField: '_id',
        fields: null,
        pageSize: 10,
        maxPageSize: 100,
        maxLimit: -1,
        entityValidator: null,
    },
    actions: {
        find: {
            cache: {
                keys: [
                    'fields',
                    'limit',
                    'offset',
                    'sort',
                    'search',
                    'searchFields',
                    'query',
                ],
            },
            params: {
                fields: [
                    { type: 'string', optional: true },
                    { type: 'array', optional: true, items: 'string' },
                ],
                limit: {
                    type: 'number',
                    integer: true,
                    min: 0,
                    optional: true,
                    convert: true,
                },
                offset: {
                    type: 'number',
                    integer: true,
                    min: 0,
                    optional: true,
                    convert: true,
                },
                sort: { type: 'string', optional: true },
                search: { type: 'string', optional: true },
                searchFields: [
                    { type: 'string', optional: true },
                    { type: 'array', optional: true, items: 'string' },
                ],
                query: { type: 'object', optional: true },
            },
            handler(ctx) {
                let params = this.sanitizeParams(ctx, ctx.params);
                return this._find(ctx, params);
            },
        },
        count: {
            cache: {
                keys: ['search', 'searchFields', 'query'],
            },
            params: {
                search: { type: 'string', optional: true },
                searchFields: [
                    { type: 'string', optional: true },
                    { type: 'array', optional: true, items: 'string' },
                ],
                query: { type: 'object', optional: true },
            },
            handler(ctx) {
                let params = this.sanitizeParams(ctx, ctx.params);
                return this._count(ctx, params);
            },
        },
        list: {
            cache: {
                keys: [
                    'fields',
                    'page',
                    'pageSize',
                    'sort',
                    'search',
                    'searchFields',
                    'query',
                ],
            },
            rest: 'GET /',
            params: {
                fields: [
                    { type: 'string', optional: true },
                    { type: 'array', optional: true, items: 'string' },
                ],
                page: {
                    type: 'number',
                    integer: true,
                    min: 1,
                    optional: true,
                    convert: true,
                },
                pageSize: {
                    type: 'number',
                    integer: true,
                    min: 0,
                    optional: true,
                    convert: true,
                },
                sort: { type: 'string', optional: true },
                search: { type: 'string', optional: true },
                searchFields: [
                    { type: 'string', optional: true },
                    { type: 'array', optional: true, items: 'string' },
                ],
                query: { type: 'object', optional: true },
            },
            handler(ctx) {
                let params = this.sanitizeParams(ctx, ctx.params);
                return this._list(ctx, params);
            },
        },
        save: {
            rest: 'POST /',
            handler(ctx) {
                let meta = ctx.meta;
                return this._save(ctx, meta);
            },
        },
        get: {
            cache: {
                keys: ['id', 'fields', 'mapping'],
            },
            rest: 'GET /:id',
            params: {
                id: [{ type: 'string' }, { type: 'number' }],
            },
            async handler(ctx) {
                const stream = await this._get(ctx, ctx.params);
                return stream;
            },
        },
        update: {
            rest: 'PUT /:id',
            handler(ctx) {
                let meta = ctx.meta;
                return this._update(ctx, meta);
            },
        },
        remove: {
            rest: 'DELETE /:id',
            params: {
                id: { type: 'any' },
            },
            handler(ctx) {
                let params = this.sanitizeParams(ctx, ctx.params);
                return this._remove(ctx, params);
            },
        },
    },
    methods: {
        connect(ctx) {
            return this.adapter.connect().then(() => {
                if ((0, lodash_isfunction_1.default)(this.schema.afterConnected)) {
                    try {
                        return this.schema.afterConnected.call(this);
                    }
                    catch (err) {
                        this.logger.error('afterConnected error!', err);
                    }
                }
            });
        },
        disconnect() {
            if ((0, lodash_isfunction_1.default)(this.adapter.disconnect))
                return this.adapter.disconnect();
        },
        sanitizeParams(ctx, params) {
            let p = Object.assign({}, params);
            if (typeof p.limit === 'string')
                p.limit = Number(p.limit);
            if (typeof p.offset === 'string')
                p.offset = Number(p.offset);
            if (typeof p.page === 'string')
                p.page = Number(p.page);
            if (typeof p.pageSize === 'string')
                p.pageSize = Number(p.pageSize);
            if (typeof p.sort === 'string')
                p.sort = p.sort.replace(/,/g, ' ').split(' ');
            if (typeof p.fields === 'string')
                p.fields = p.fields.replace(/,/g, ' ').split(' ');
            if (typeof p.populate === 'string')
                p.populate = p.populate.replace(/,/g, ' ').split(' ');
            if (typeof p.searchFields === 'string')
                p.searchFields = p.searchFields.replace(/,/g, ' ').split(' ');
            if (ctx.action.name.endsWith('.list')) {
                if (!p.pageSize)
                    p.pageSize = this.settings.pageSize;
                if (!p.page)
                    p.page = 1;
                if (this.settings.maxPageSize > 0 &&
                    p.pageSize > this.settings.maxPageSize)
                    p.pageSize = this.settings.maxPageSize;
                p.limit = p.pageSize;
                p.offset = (p.page - 1) * p.pageSize;
            }
            if (this.settings.maxLimit > 0 && p.limit > this.settings.maxLimit)
                p.limit = this.settings.maxLimit;
            return p;
        },
        entityChanged(ctx, type, json) {
            return this.clearCache().then(() => {
                const eventName = `entity${(0, lodash_capitalize_1.default)(type)}`;
                if (this.schema[eventName] != null) {
                    return this.schema[eventName].call(this, json, ctx);
                }
            });
        },
        clearCache() {
            this.broker.broadcast(`cache.clean.${this.fullName}`);
            if (this.broker.cacher)
                return this.broker.cacher.clean(`${this.fullName}.*`);
            return bluebird_1.default.resolve();
        },
        async transformDocuments(params, ctx, docs) {
            let isDoc = false;
            if (!Array.isArray(docs)) {
                if ((0, lodash_isobject_1.default)(docs)) {
                    isDoc = true;
                    docs = [docs];
                }
                else
                    return bluebird_1.default.resolve(docs);
            }
            return (bluebird_1.default.resolve(docs)
                .map((doc) => {
                doc[this.settings.idField] = this.encodeID(doc[this.settings.idField]);
                return doc;
            })
                .then((docs) => docs.map((doc) => this.adapter.afterRetrieveTransformID
                ? this.adapter.afterRetrieveTransformID(doc, this.settings.idField)
                : doc))
                .then((json) => ctx && params.populate
                ? this.populateDocs(ctx, json, params.populate)
                : json)
                .then((json) => {
                let fields = ctx && params.fields
                    ? params.fields
                    : this.settings.fields;
                if ((0, lodash_isstring_1.default)(fields))
                    fields = fields.split(' ');
                const authFields = this.authorizeFields(fields);
                return json.map((item) => this.filterFields(item, authFields));
            })
                .then((json) => (isDoc ? json[0] : json)));
        },
        filterFields(doc, fields) {
            if (Array.isArray(fields)) {
                let res = {};
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
            if (this.settings.fields && this.settings.fields.length > 0) {
                let res = [];
                if (Array.isArray(fields) && fields.length > 0) {
                    fields.forEach((f) => {
                        if (this.settings.fields.indexOf(f) !== -1) {
                            res.push(f);
                            return;
                        }
                        if (f.indexOf('.') !== -1) {
                            let parts = f.split('.');
                            while (parts.length > 1) {
                                parts.pop();
                                if (this.settings.fields.indexOf(parts.join('.')) !== -1) {
                                    res.push(f);
                                    break;
                                }
                            }
                        }
                        let nestedFields = this.settings.fields.filter((prop) => prop.indexOf(f + '.') !== -1);
                        if (nestedFields.length > 0) {
                            res = res.concat(nestedFields);
                        }
                    });
                }
                return res;
            }
            return fields;
        },
        async validateEntity(entity) {
            if (!(0, lodash_isfunction_1.default)(this.settings.entityValidator))
                return bluebird_1.default.resolve(entity);
            let entities = Array.isArray(entity) ? entity : [entity];
            return bluebird_1.default.all(entities.map((entity) => this.settings.entityValidator.call(this, entity))).then(() => entity);
        },
        encodeID(id) {
            return id;
        },
        decodeID(id) {
            return id;
        },
        async _find(ctx, params) {
            return this.adapter
                .find(params)
                .then((docs) => this.transformDocuments(ctx, params, docs));
        },
        async _count(ctx, params) {
            if (params && params.limit)
                params.limit = null;
            if (params && params.offset)
                params.offset = null;
            return this.adapter.count(params);
        },
        async _list(ctx, params) {
            let countParams = Object.assign({}, params);
            if (countParams && countParams.limit)
                countParams.limit = null;
            if (countParams && countParams.offset)
                countParams.offset = null;
            return bluebird_1.default.all([
                this.adapter.find(params),
                this.adapter.count(countParams),
            ]).then((res) => {
                return this.transformDocuments(ctx, params, res[0]).then((docs) => {
                    return {
                        rows: docs,
                        total: res[1],
                        page: params.page,
                        pageSize: params.pageSize,
                        totalPages: Math.floor((res[1] + params.pageSize - 1) /
                            params.pageSize),
                    };
                });
            });
        },
        async _save(ctx, meta) {
            let entity = ctx.params;
            return this.adapter.save(entity, meta);
        },
        async _get(ctx, params) {
            return this.adapter.findById(params.id);
        },
        async _update(ctx, meta) {
            let id;
            Object.keys(meta).forEach((prop) => {
                if (prop == 'id' || prop == this.settings.idField)
                    id = this.decodeID(meta[prop]);
                else
                    throw new errors_1.FileNotFoundError('No valid ID');
            });
            return this.adapter.updateById(ctx.params, id);
        },
        async _remove(ctx, params) {
            const id = this.decodeID(params.id);
            return this.adapter.removeById(id).then((doc) => {
                if (!doc)
                    return bluebird_1.default.reject(new errors_1.FileNotFoundError(String(params.id)));
                return this.transformDocuments(ctx, params, doc).then((json) => this.entityChanged('removed', json, ctx).then(() => json));
            });
        },
    },
    created() {
        if ((0, lodash_isstring_1.default)(this.settings.fields)) {
            this.settings.fields = this.settings.fields.split(' ');
        }
        if (!this.schema.adapter)
            this.adapter = null;
        else
            this.adapter = this.schema.adapter;
        this.adapter.init(this.broker, this);
        if (this.broker.validator &&
            (0, lodash_isobject_1.default)(this.settings.entityValidator) &&
            !(0, lodash_isfunction_1.default)(this.settings.entityValidator)) {
            const check = this.broker.validator.compile(this.settings.entityValidator);
            this.settings.entityValidator = (entity) => {
                const res = check(entity);
                if (res === true)
                    return bluebird_1.default.resolve();
                else
                    return bluebird_1.default.reject(new ValidationError('Entity validation error!', null, res));
            };
        }
    },
    started() {
        if (this.adapter) {
            return new bluebird_1.default((resolve) => {
                let connecting = () => {
                    this.connect()
                        .then(resolve)
                        .catch((err) => {
                        this.logger.error('Connection error!', err);
                        setTimeout(() => {
                            this.logger.warn('Reconnecting...');
                            connecting();
                        }, 1000);
                    });
                };
                connecting();
            });
        }
        return bluebird_1.default.reject(new Error('Please set the store adapter in schema!'));
    },
    stopped() {
        if (this.adapter)
            return this.disconnect();
    },
};
exports.default = MoleculerFilesAdapter;
