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

/**
 * How durable the current session is, and therefore whether the storage key may be written.
 *
 * `future-blocked` exists because the stored record was written by a newer schema this build
 * cannot read. The session stays usable in memory, but writing would replace data it never
 * understood, so it fails closed until the user explicitly asks for the replacement.
 */
export type PersistenceMode =
	| "durable"
	| "session-only"
	| "save-failed"
	| "future-blocked";

export const writablePersistenceModes = new Set<PersistenceMode>([
	"durable",
	"save-failed",
]);

export function canPersist(mode: PersistenceMode) {
	return writablePersistenceModes.has(mode);
}

export interface LoadResult {
	mode: Exclude<PersistenceMode, "save-failed">;
	state: PersistedStateV1;
	message?: string;
	/**
	 * The untouched bytes of an incompatible newer record. Opaque on purpose: it is offered back
	 * to the user as a download and never interpreted through the current schema.
	 */
	incompatibleRecord?: string;
}

export interface PersistenceAdapter {
	load(): LoadResult;
	save(state: PersistedStateV1): { ok: true } | { ok: false; message: string };
}

export function serializePersistedState(state: PersistedStateV1) {
	return JSON.stringify(persistedStateV1Schema.parse(state));
}

function isFutureRecord(value: unknown) {
	return (
		typeof value === "object" &&
		value !== null &&
		"schemaVersion" in value &&
		typeof value.schemaVersion === "number" &&
		value.schemaVersion > CURRENT_SCHEMA_VERSION
	);
}

export function createPersistenceAdapter(
	storage: StorageLike | undefined,
): PersistenceAdapter {
	return {
		load() {
			if (!storage) {
				return {
					mode: "session-only",
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
					mode: "session-only",
					state: createDefaultState(),
					message:
						"AtlasTint could not read browser storage. Changes will remain usable for this session only.",
				};
			}
			if (raw === null) return { mode: "durable", state: createDefaultState() };
			try {
				const parsed: unknown = JSON.parse(raw);
				if (isFutureRecord(parsed)) {
					return {
						mode: "future-blocked",
						state: createDefaultState(),
						incompatibleRecord: raw,
						message:
							"Saved progress was created by a newer AtlasTint version. It is left untouched and this session will not be saved.",
					};
				}
				return { mode: "durable", state: migratePersistedState(parsed) };
			} catch {
				return {
					mode: "durable",
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
