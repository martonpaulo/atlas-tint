import { themePreferenceSchema } from "@/features/atlas/domain";
import {
	CURRENT_SCHEMA_VERSION,
	createDefaultState,
	migratePersistedState,
	type PersistedState,
	persistedStateSchema,
	STORAGE_KEY,
} from "@/features/atlas/persistence-schema";

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem?(key: string): void;
}

/**
 * The key `next-themes` used to own before appearance became part of the versioned record.
 *
 * It is read exactly once, only when there is no Atlas record at all, so an upgrading user
 * keeps the appearance they chose. When both exist the Atlas record wins, because it is the
 * one import, export, and reset carry.
 */
export const LEGACY_THEME_KEY = "atlas-tint:theme";

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
	state: PersistedState;
	message?: string;
	/**
	 * The untouched bytes of an incompatible newer record. Opaque on purpose: it is offered back
	 * to the user as a download and never interpreted through the current schema.
	 */
	incompatibleRecord?: string;
	/**
	 * A preference was taken from the pre-versioned appearance key. The caller must write the
	 * state once so the value lands under the one durable authority and the old key retires.
	 */
	adoptedLegacyTheme?: boolean;
}

export interface PersistenceAdapter {
	load(): LoadResult;
	save(state: PersistedState): { ok: true } | { ok: false; message: string };
}

export function serializePersistedState(state: PersistedState) {
	return JSON.stringify(persistedStateSchema.parse(state));
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
	/** Cleared only after the adopted preference is durably written under the Atlas key. */
	let legacyThemeToRetire = false;

	function adoptLegacyTheme(state: PersistedState) {
		if (!storage) return state;
		let legacy: string | null = null;
		try {
			legacy = storage.getItem(LEGACY_THEME_KEY);
		} catch {
			return state;
		}
		const preference = themePreferenceSchema.safeParse(legacy);
		if (!preference.success) return state;
		legacyThemeToRetire = true;
		return { ...state, themePreference: preference.data };
	}

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
			if (raw === null) {
				const state = adoptLegacyTheme(createDefaultState());
				return {
					mode: "durable",
					state,
					adoptedLegacyTheme: legacyThemeToRetire,
				};
			}
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
				if (legacyThemeToRetire) {
					legacyThemeToRetire = false;
					// The preference now lives in the versioned record; nothing reads the old key.
					try {
						storage.removeItem?.(LEGACY_THEME_KEY);
					} catch {}
				}
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
