import { Errors } from "moleculer";

/**
 * File not found (HTTP 404).
 */
export class FileNotFoundError extends Errors.MoleculerClientError {
	constructor(id: string) {
		super("File not found", 404, "ERR_FILE_NOT_FOUND", { id });
	}
}
