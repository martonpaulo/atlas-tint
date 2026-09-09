/**
 * Defensive bounds for imported progress files.
 *
 * These are headroom, not supported product totals. A complete export of the current catalog —
 * all 274 selectable entities across World, Brazil, and Spain, every one selected with a custom
 * color — measures about 30 KB, so the byte ceiling below is over thirty times a full file.
 * The point is to reject a file that could freeze the tab before it is read, not to describe
 * how much progress AtlasTint supports.
 *
 * Rejection is always preferable to silent truncation: a partially imported file would quietly
 * change durable user data.
 */
export const importLimits = {
	/** Checked against `File.size` before reading, and again against the decoded text. */
	maxBytes: 1024 * 1024,
	/** Room for far more presets than the catalog ships, without allowing unbounded records. */
	maxPresets: 32,
	/** Per preset. The largest current preset has 195 entities. */
	maxSelections: 2_000,
	/** Per preset, matching the selection bound. */
	maxCustomColors: 2_000,
	/** Entity and preset IDs are short, stable, application-owned strings. */
	maxKeyLength: 128,
} as const;

export function formatByteLimit(bytes: number) {
	return `${Math.round(bytes / 1024)} KB`;
}
