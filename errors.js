/*
 * moleculer-db
 * Copyright (c) 2019 MoleculerJS (https://github.com/moleculerjs/moleculer-db)
 * MIT Licensed
 */

"use strict";

const { MoleculerClientError } = require("moleculer").Errors;

//const ERR_FILENOT_FOUND = "ERR_FILE_NOT_FOUND";

/**
 * File not found
 *
 * @class FileNotFoundError
 * @extends {MoleculerClientError}
 */
class FileNotFoundError extends MoleculerClientError {

	/**
	 * Creates an instance of FileNotFoundError.
	 *
	 * @param {any} ID of entity
	 *
	 * @memberOf FileNotFoundError
	 */
	constructor(id) {
		super("File not found", 404, null, {
			id
		});
	}
}


module.exports = {
	FileNotFoundError

	//ERR_FILE_NOT_FOUND,
};