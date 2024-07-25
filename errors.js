"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileNotFoundError = void 0;
const moleculer_1 = require("moleculer");
const { MoleculerClientError } = moleculer_1.Errors;
class FileNotFoundError extends MoleculerClientError {
    constructor(id) {
        super("File not found", 404, null, {
            id
        });
    }
}
exports.FileNotFoundError = FileNotFoundError;
