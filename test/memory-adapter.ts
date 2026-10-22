import { Readable } from "node:stream";
import type { Service, ServiceBroker } from "moleculer";
import type { AdapterSchema, FileId, QueryParams } from "../src";

type Entry = { _id: string; data: Buffer; meta: Record<string, unknown> };

/** In-memory storage driver: the base package has none, so this stands in for the real ones. */
export class MemoryAdapter implements AdapterSchema {
	files = new Map<string, Entry>();
	events: string[] = [];
	failConnect = 0;
	service!: Service;
	private seq = 0;

	init(broker: ServiceBroker, service: Service) {
		this.service = service;
		this.events.push("init");
	}

	async connect() {
		this.events.push("connect");
		if (this.failConnect-- > 0) throw new Error("storage down");
	}

	disconnect() {
		this.events.push("disconnect");
	}

	async find(params: QueryParams) {
		let rows = [...this.files.values()].map((f) => ({ _id: f._id, length: f.data.length, meta: f.meta }));
		if (params.offset) rows = rows.slice(params.offset);
		if (params.limit) rows = rows.slice(0, params.limit);
		return rows;
	}

	async count() {
		return this.files.size;
	}

	async findById(id: FileId) {
		const f = this.files.get(String(id));
		return f ? Readable.from([f.data]) : undefined;
	}

	async save(entity: NodeJS.ReadableStream, meta: Record<string, unknown>) {
		const chunks: Buffer[] = [];
		for await (const c of entity) chunks.push(Buffer.from(c as Buffer));
		const _id = String(meta.id ?? `f${++this.seq}`);
		this.files.set(_id, { _id, data: Buffer.concat(chunks), meta: { ...meta } });
		return { _id };
	}

	async updateById(entity: NodeJS.ReadableStream, id: FileId) {
		return this.save(entity, { id });
	}

	async removeById(id: FileId) {
		const f = this.files.get(String(id));
		if (!f) return null;
		this.files.delete(String(id));
		return { _id: f._id };
	}
}
