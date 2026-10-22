import { Errors } from "moleculer";
/**
 * File not found (HTTP 404).
 */
export declare class FileNotFoundError extends Errors.MoleculerClientError {
    constructor(id: string);
}
