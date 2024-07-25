import { Errors } from "moleculer";
declare const MoleculerClientError: typeof Errors.MoleculerClientError;
declare class FileNotFoundError extends MoleculerClientError {
    constructor(id: string);
}
export { FileNotFoundError };
