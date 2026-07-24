import {
	CURRENT_SCHEMA_VERSION,
	createDefaultState,
	migratePersistedState,
	type PersistedStateV1,
	persistedStateV1Schema,
	STORAGE_KEY,
} from "@/features/atlas/persistence-schema";

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export type LoadResult =
	| { status: "ok"; state: PersistedStateV1 }
	| { status: "recovered"; state: PersistedStateV1; message: string }
	| { status: "future"; state: PersistedStateV1; message: string }
	| { status: "unavailable"; state: PersistedStateV1; message: string };

export interface PersistenceAdapter {
	load(): LoadResult;
	save(state: PersistedStateV1): { ok: true } | { ok: false; message: string };
}

export function serializePersistedState(state: PersistedStateV1) {
	return JSON.stringify(persistedStateV1Schema.parse(state));
}

export function createPersistenceAdapter(
	storage: StorageLike | undefined,
): PersistenceAdapter {
	return {
		load() {
			if (!storage) {
				return {
					status: "unavailable",
					state: createDefaultState(),
					message:
						"Browser storage is unavailable. Changes will remain usable for this session only.",
				};
			}
			let raw: string | null;
			try {
				raw = storage.getItem(STORAGE_KEY);
			} catch {
				return {
					status: "unavailable",
					state: createDefaultState(),
					message:
						"AtlasTint could not read browser storage. Changes will remain usable for this session only.",
				};
			}
			if (raw === null) return { status: "ok", state: createDefaultState() };
			try {
				const parsed: unknown = JSON.parse(raw);
				if (
					typeof parsed === "object" &&
					parsed !== null &&
					"schemaVersion" in parsed &&
					typeof parsed.schemaVersion === "number" &&
					parsed.schemaVersion > CURRENT_SCHEMA_VERSION
				) {
					return {
						status: "future",
						state: createDefaultState(),
						message:
							"Saved progress was created by a newer AtlasTint version and was not changed.",
					};
				}
				const state = migratePersistedState(parsed);
				return { status: "ok", state };
			} catch {
				return {
					status: "recovered",
					state: createDefaultState(),
					message:
						"Saved progress was malformed. AtlasTint started safely with empty progress.",
				};
			}
		},
		save(state) {
			if (!storage)
				return { ok: false, message: "Browser storage is unavailable." };
			try {
				storage.setItem(STORAGE_KEY, serializePersistedState(state));
				return { ok: true };
			} catch {
				return {
					ok: false,
					message: "AtlasTint could not save progress in browser storage.",
				};
			}
		},
	};
}

export function createBrowserPersistenceAdapter() {
	if (typeof window === "undefined") return createPersistenceAdapter(undefined);
	try {
		return createPersistenceAdapter(window.localStorage);
	} catch {
		return createPersistenceAdapter(undefined);
	}
}
