export const name: string;
export namespace metadata {
    const $category: string;
    const $official: boolean;
    const $name: any;
    const $version: any;
    const $repo: any;
}
export const adapter: any;
export namespace settings {
    const idField: string;
    const fields: Array<string> | null;
    const pageSize: number;
    const maxPageSize: number;
    const maxLimit: number;
    const entityValidator: any | Function;
}
export namespace actions {
    namespace find {
        namespace cache {
            const keys: string[];
        }
        namespace params {
            const fields_1: ({
                type: string;
                optional: boolean;
                items?: undefined;
            } | {
                type: string;
                optional: boolean;
                items: string;
            })[];
            export { fields_1 as fields };
            export namespace limit {
                const type: string;
                const integer: boolean;
                const min: number;
                const optional: boolean;
                const convert: boolean;
            }
            export namespace offset {
                const type_1: string;
                export { type_1 as type };
                const integer_1: boolean;
                export { integer_1 as integer };
                const min_1: number;
                export { min_1 as min };
                const optional_1: boolean;
                export { optional_1 as optional };
                const convert_1: boolean;
                export { convert_1 as convert };
            }
            export namespace sort {
                const type_2: string;
                export { type_2 as type };
                const optional_2: boolean;
                export { optional_2 as optional };
            }
            export namespace search {
                const type_3: string;
                export { type_3 as type };
                const optional_3: boolean;
                export { optional_3 as optional };
            }
            export const searchFields: ({
                type: string;
                optional: boolean;
                items?: undefined;
            } | {
                type: string;
                optional: boolean;
                items: string;
            })[];
            export namespace query {
                const type_4: string;
                export { type_4 as type };
                const optional_4: boolean;
                export { optional_4 as optional };
            }
        }
        function handler(ctx: any): any;
    }
    namespace count {
        export namespace cache_1 {
            const keys_1: string[];
            export { keys_1 as keys };
        }
        export { cache_1 as cache };
        export namespace params_1 {
            export namespace search_1 {
                const type_5: string;
                export { type_5 as type };
                const optional_5: boolean;
                export { optional_5 as optional };
            }
            export { search_1 as search };
            const searchFields_1: ({
                type: string;
                optional: boolean;
                items?: undefined;
            } | {
                type: string;
                optional: boolean;
                items: string;
            })[];
            export { searchFields_1 as searchFields };
            export namespace query_1 {
                const type_6: string;
                export { type_6 as type };
                const optional_6: boolean;
                export { optional_6 as optional };
            }
            export { query_1 as query };
        }
        export { params_1 as params };
        export function handler(ctx: any): any;
    }
    namespace list {
        export namespace cache_2 {
            const keys_2: string[];
            export { keys_2 as keys };
        }
        export { cache_2 as cache };
        export const rest: string;
        export namespace params_2 {
            const fields_2: ({
                type: string;
                optional: boolean;
                items?: undefined;
            } | {
                type: string;
                optional: boolean;
                items: string;
            })[];
            export { fields_2 as fields };
            export namespace page {
                const type_7: string;
                export { type_7 as type };
                const integer_2: boolean;
                export { integer_2 as integer };
                const min_2: number;
                export { min_2 as min };
                const optional_7: boolean;
                export { optional_7 as optional };
                const convert_2: boolean;
                export { convert_2 as convert };
            }
            export namespace pageSize_1 {
                const type_8: string;
                export { type_8 as type };
                const integer_3: boolean;
                export { integer_3 as integer };
                const min_3: number;
                export { min_3 as min };
                const optional_8: boolean;
                export { optional_8 as optional };
                const convert_3: boolean;
                export { convert_3 as convert };
            }
            export { pageSize_1 as pageSize };
            export namespace sort_1 {
                const type_9: string;
                export { type_9 as type };
                const optional_9: boolean;
                export { optional_9 as optional };
            }
            export { sort_1 as sort };
            export namespace search_2 {
                const type_10: string;
                export { type_10 as type };
                const optional_10: boolean;
                export { optional_10 as optional };
            }
            export { search_2 as search };
            const searchFields_2: ({
                type: string;
                optional: boolean;
                items?: undefined;
            } | {
                type: string;
                optional: boolean;
                items: string;
            })[];
            export { searchFields_2 as searchFields };
            export namespace query_2 {
                const type_11: string;
                export { type_11 as type };
                const optional_11: boolean;
                export { optional_11 as optional };
            }
            export { query_2 as query };
        }
        export { params_2 as params };
        export function handler(ctx: any): any;
    }
    namespace save {
        const rest_1: string;
        export { rest_1 as rest };
        export function handler(ctx: any): any;
    }
    namespace get {
        export namespace cache_3 {
            const keys_3: string[];
            export { keys_3 as keys };
        }
        export { cache_3 as cache };
        const rest_2: string;
        export { rest_2 as rest };
        export namespace params_3 {
            const id: {
                type: string;
            }[];
        }
        export { params_3 as params };
        export function handler(ctx: any): Promise<any>;
    }
    namespace update {
        const rest_3: string;
        export { rest_3 as rest };
        export function handler(ctx: any): any;
    }
    namespace remove {
        const rest_4: string;
        export { rest_4 as rest };
        export namespace params_4 {
            export namespace id_1 {
                const type_12: string;
                export { type_12 as type };
            }
            export { id_1 as id };
        }
        export { params_4 as params };
        export function handler(ctx: any): any;
    }
}
export namespace methods {
    /**
     * Connect to database.
     */
    function connect(): any;
    /**
     * Disconnect from database.
     */
    function disconnect(): any;
    /**
     * Sanitize context parameters at `find` action.
     *
     * @param {Context} ctx
     * @param {any} origParams
     * @returns {Promise}
     */
    function sanitizeParams(ctx: Context, params: any): Promise;
    function entityChanged(type: any, json: any, ctx: any): any;
    function clearCache(): any;
    function transformDocuments(ctx: any, params: any, docs: any): any;
    function filterFields(doc: any, fields: any): any;
    function authorizeFields(fields: any): any;
    function validateEntity(entity: any): any;
    function encodeID(id: any): any;
    function decodeID(id: any): any;
    function _find(ctx: any, params: any): any;
    function _count(ctx: any, params: any): any;
    function _list(ctx: any, params: any): any;
    function _save(ctx: any, meta: any): any;
    function _get(ctx: any, params: any): Promise<any>;
    function _update(ctx: any, meta: any): any;
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
    function _remove(ctx: any, params: any): number;
}
/**
 * Service created lifecycle event handler
 */
export function created(): void;
/**
 * Service started lifecycle event handler
 */
export function started(): any;
/**
 * Service stopped lifecycle event handler
 */
export function stopped(): any;
