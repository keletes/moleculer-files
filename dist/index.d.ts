import type { Context, Service, ServiceBroker, ServiceSchema } from "moleculer";
import { FileNotFoundError } from "./errors";
export { FileNotFoundError };
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
    entityValidator: Record<string, unknown> | Function | null;
    [name: string]: unknown;
}
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
export type FilesService = Service<FilesSettings> & FilesMethods & {
    adapter: AdapterSchema;
};
/**
 * Service mixin to access file streams. Add it to `mixins` and set `adapter` (and, for the drivers that need
 * it, `collection`) in the service schema.
 */
declare const MoleculerFilesAdapter: ServiceSchema & ThisType<FilesService>;
export default MoleculerFilesAdapter;
