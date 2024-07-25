/// <reference types="node" />
import Promise from "bluebird";
export type QueryParams = {
    id?: number | string;
    limit?: number;
    offset?: number;
    page?: number;
    pageSize?: number;
    sort?: string | string[];
    fields?: string | string[];
    populate?: string | string[];
    searchFields?: string | string[];
};
export interface AdapterSchema {
    connect?: Function;
    disconnect?: Function;
    find?: (params: QueryParams) => Promise<any[]>;
    findById?: (id: QueryParams['id']) => Promise<NodeJS.WritableStream>;
    count?: (params: QueryParams) => Promise<number>;
    save?: (entity: NodeJS.ReadableStream, meta: any) => Promise<any>;
    updateById?: (entity: NodeJS.ReadableStream, meta: any) => Promise<any>;
    removeById?: (id: QueryParams['id']) => Promise<any[]>;
    afterRetrieveTransformID?: (document: any, idField: string) => Promise<any>;
}
