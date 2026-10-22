import { Readable } from "node:stream";
import { Errors, ServiceBroker } from "moleculer";
import type { ServiceSchema } from "moleculer";
import FilesMixin, { FileNotFoundError } from "../../src";
import { MemoryAdapter } from "../memory-adapter";

const readAll = async (stream: NodeJS.ReadableStream) => {
	const chunks: Buffer[] = [];
	for await (const c of stream) chunks.push(Buffer.from(c as Buffer));
	return Buffer.concat(chunks).toString();
};

describe("moleculer-files mixin", () => {
	let broker: ServiceBroker;
	let adapter: MemoryAdapter;
	const removed: unknown[] = [];

	const build = (extra: Partial<ServiceSchema> = {}, settings: Record<string, unknown> = {}) => {
		const schema: ServiceSchema = {
			name: "files",
			mixins: [FilesMixin],
			adapter: new MemoryAdapter(),
			settings,
			entityRemoved(json: unknown) {
				removed.push(json);
			},
			...extra,
		};
		const svc = broker.createService(schema);
		// Moleculer merges the schema, so the service holds its own copy of the adapter instance
		adapter = (svc as any).adapter;
		return svc;
	};

	beforeEach(() => {
		broker = new ServiceBroker({ logger: false });
		removed.length = 0;
	});
	afterEach(() => broker.stop());

	it("exposes the package metadata", async () => {
		const svc = build();
		await broker.start();
		expect(svc.metadata).toMatchObject({ $category: "files", $name: "moleculer-files" });
	});

	it("runs the adapter lifecycle and afterConnected", async () => {
		const afterConnected = jest.fn();
		build({ afterConnected });
		await broker.start();
		expect(adapter.events).toEqual(["init", "connect"]);
		expect(afterConnected).toHaveBeenCalledTimes(1);
		await broker.stop();
		expect(adapter.events).toEqual(["init", "connect", "disconnect"]);
	});

	it("keeps retrying to connect until the storage is up", async () => {
		jest.useFakeTimers({ advanceTimers: true });
		try {
			build();
			adapter.failConnect = 2;
			const started = broker.start();
			await jest.advanceTimersByTimeAsync(2500);
			await started;
			expect(adapter.events.filter((e) => e === "connect")).toHaveLength(3);
		} finally {
			jest.useRealTimers();
		}
	});

	it("refuses a service without adapter", () => {
		expect(() => broker.createService({ name: "files", mixins: [FilesMixin] })).toThrow(Errors.ServiceSchemaError);
	});

	describe("actions", () => {
		beforeEach(async () => {
			build();
			await broker.start();
		});

		const save = (content: string, id?: string) =>
			broker.call("files.save", Readable.from([Buffer.from(content)]), { meta: id ? { id } : {} });

		it("saves a stream and streams it back with get", async () => {
			await save("hello", "a.txt");
			const stream = (await broker.call("files.get", { id: "a.txt" })) as NodeJS.ReadableStream;
			expect(await readAll(stream)).toBe("hello");
		});

		it("get of a missing file is a 404 FileNotFoundError", async () => {
			await expect(broker.call("files.get", { id: "nope" })).rejects.toMatchObject({
				name: "FileNotFoundError",
				code: 404,
				data: { id: "nope" },
			});
			await expect(broker.call("files.get", { id: "nope" })).rejects.toBeInstanceOf(FileNotFoundError);
		});

		it("get maps an adapter 404 to FileNotFoundError and rethrows other errors", async () => {
			adapter.findById = async () => {
				throw Object.assign(new Error("gone"), { code: 404 });
			};
			await expect(broker.call("files.get", { id: "x" })).rejects.toBeInstanceOf(FileNotFoundError);
			adapter.findById = async () => {
				throw new Error("boom");
			};
			await expect(broker.call("files.get", { id: "x" })).rejects.toThrow("boom");
		});

		it("validates the get id", async () => {
			await expect(broker.call("files.get", {})).rejects.toBeInstanceOf(Errors.ValidationError);
		});

		it("find returns the adapter entries and honours limit/offset", async () => {
			for (const id of ["1", "2", "3"]) await save(id, id);
			expect(await broker.call("files.find")).toHaveLength(3);
			expect(await broker.call("files.find", { limit: 2, offset: 1 })).toMatchObject([{ _id: "2" }, { _id: "3" }]);
		});

		it("find filters fields (nested paths too)", async () => {
			await save("x", "1");
			expect(await broker.call("files.find", { fields: "_id,length" })).toEqual([{ _id: "1", length: 1 }]);
			expect(await broker.call("files.find", { fields: ["meta.id"] })).toEqual([{ meta: { id: "1" } }]);
		});

		it("count returns the number of files", async () => {
			await save("1", "1");
			await save("2", "2");
			expect(await broker.call("files.count")).toBe(2);
		});

		it("list paginates", async () => {
			for (let i = 1; i <= 5; i++) await save(String(i), String(i));
			const page = (await broker.call("files.list", { page: 2, pageSize: 2 })) as any;
			expect(page).toMatchObject({ total: 5, page: 2, pageSize: 2, totalPages: 3 });
			expect(page.rows.map((r: any) => r._id)).toEqual(["3", "4"]);
		});

		it("list applies the default page size and caps it at maxPageSize", async () => {
			expect(await broker.call("files.list")).toMatchObject({ page: 1, pageSize: 10, rows: [], total: 0 });
			expect(await broker.call("files.list", { pageSize: 1000 })).toMatchObject({ pageSize: 100 });
		});

		it("update stores new content for the id", async () => {
			await save("old", "a.txt");
			await broker.call("files.update", Readable.from([Buffer.from("new")]), { meta: { id: "a.txt" } });
			const stream = (await broker.call("files.get", { id: "a.txt" })) as NodeJS.ReadableStream;
			expect(await readAll(stream)).toBe("new");
		});

		it("update with meta other than the id is rejected", async () => {
			await expect(
				broker.call("files.update", Readable.from([Buffer.from("x")]), { meta: { id: "a", other: 1 } }),
			).rejects.toBeInstanceOf(FileNotFoundError);
		});

		it("remove deletes the file, returns it and fires entityRemoved", async () => {
			await save("x", "a.txt");
			expect(await broker.call("files.remove", { id: "a.txt" })).toEqual({ _id: "a.txt" });
			expect(removed).toEqual([{ _id: "a.txt" }]);
			await expect(broker.call("files.get", { id: "a.txt" })).rejects.toBeInstanceOf(FileNotFoundError);
		});

		it("remove of a missing file is a 404", async () => {
			await expect(broker.call("files.remove", { id: "ghost" })).rejects.toMatchObject({ code: 404 });
			expect(removed).toHaveLength(0);
		});

		it("remove clears the cache of the service", async () => {
			const clean = jest.spyOn(broker, "broadcast");
			await save("x", "a.txt");
			await broker.call("files.remove", { id: "a.txt" });
			expect(clean).toHaveBeenCalledWith("cache.clean.files");
		});
	});

	describe("settings", () => {
		it("settings.fields restricts the returned and requestable fields", async () => {
			build({}, { fields: ["_id", "length"] });
			await broker.start();
			await broker.call("files.save", Readable.from([Buffer.from("abc")]), { meta: { id: "1" } });
			expect(await broker.call("files.find")).toEqual([{ _id: "1", length: 3 }]);
			// "meta" is not authorised even when requested
			expect(await broker.call("files.find", { fields: ["_id", "meta"] })).toEqual([{ _id: "1" }]);
		});

		it("settings.maxLimit caps find limit", async () => {
			build({}, { maxLimit: 1 });
			await broker.start();
			for (const id of ["1", "2"]) await broker.call("files.save", Readable.from([Buffer.from(id)]), { meta: { id } });
			expect(await broker.call("files.find", { limit: 50 })).toHaveLength(1);
		});

		it("encodeID/decodeID methods are applied", async () => {
			build({
				methods: {
					encodeID: (id: string) => `enc-${id}`,
					decodeID: (id: string) => id.replace(/^enc-/, ""),
				},
			});
			await broker.start();
			await broker.call("files.save", Readable.from([Buffer.from("x")]), { meta: { id: "1" } });
			expect(await broker.call("files.find")).toMatchObject([{ _id: "enc-1" }]);
			expect(await broker.call("files.remove", { id: "enc-1" })).toEqual({ _id: "enc-1" });
		});

		it("entityValidator schema compiles to a validator", async () => {
			const svc = build({}, { entityValidator: { name: "string" } });
			await broker.start();
			await expect((svc as any).validateEntity({ name: 5 })).rejects.toBeInstanceOf(Errors.ValidationError);
			await expect((svc as any).validateEntity({ name: "ok" })).resolves.toEqual({ name: "ok" });
		});

		it("entityValidator function is used as is and may be absent", async () => {
			const validator = jest.fn();
			const svc = build({}, { entityValidator: validator });
			await broker.start();
			await (svc as any).validateEntity([{ a: 1 }, { a: 2 }]);
			expect(validator).toHaveBeenCalledTimes(2);
			const plain = build({ name: "plain" });
			await expect((plain as any).validateEntity({ a: 1 })).resolves.toEqual({ a: 1 });
		});

		it("string settings.fields is split (compatibility with < 0.4)", async () => {
			const svc = build({}, { fields: "_id length" });
			await broker.start();
			expect(svc.settings.fields).toEqual(["_id", "length"]);
		});
	});
});
