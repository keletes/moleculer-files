"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileNotFoundError = void 0;
const moleculer_1 = require("moleculer");
/**
 * File not found (HTTP 404).
 */
class FileNotFoundError extends moleculer_1.Errors.MoleculerClientError {
    constructor(id) {
        super("File not found", 404, "ERR_FILE_NOT_FOUND", { id });
    }
}
exports.FileNotFoundError = FileNotFoundError;
//# sourceMappingURL=errors.js.map