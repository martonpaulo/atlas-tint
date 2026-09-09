import { z } from "zod";

/**
 * Deterministic merge for progress edited in more than one tab.
 *
 * Two tabs share one storage key and each writes a complete snapshot. Last writer wins loses
 * independent edits: select France in one tab and Spain in the other inside the same debounce
 * window, and one of them disappears. Every mutable field therefore carries a stamp, and merging
 * is a per-field decision instead of a whole-document one.
 *
 * A stamp is a Lamport pair. Wall-clock time is not usable: two tabs' clocks are independent and
 * can run backwards, while a Lamport counter only ever advances, including when a tab observes
 * another tab's work. Ties break on actor ID, which is arbitrary but stable and identical in both
 * tabs, so every participant reaches the same answer without coordination.
 */

export const stampSchema = z.object({
	counter: z.number().int().nonnegative(),
	/** Empty is the origin actor, which sorts below every real one and so loses every tie. */
	actor: z.string().max(64),
});
export type Stamp = z.infer<typeof stampSchema>;

export function createActorId() {
	return typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: `actor-${Math.random().toString(36).slice(2, 10)}`;
}

export function compareStamps(left: Stamp, right: Stamp) {
	if (left.counter !== right.counter) return left.counter - right.counter;
	return left.actor < right.actor ? -1 : left.actor > right.actor ? 1 : 0;
}

/** The winner of a same-field conflict. Total and antisymmetric, so merging is commutative. */
export function laterStamp(left: Stamp, right: Stamp) {
	return compareStamps(left, right) >= 0 ? left : right;
}

export interface StampedValue<Value> {
	value: Value;
	stamp: Stamp;
}

export function mergeStamped<Value>(
	left: StampedValue<Value>,
	right: StampedValue<Value>,
): StampedValue<Value> {
	return compareStamps(left.stamp, right.stamp) >= 0 ? left : right;
}

/**
 * A monotonic counter shared by every stamp this tab writes.
 *
 * Observing a remote stamp advances it past that value, which is what makes a later local edit
 * unambiguously later than the remote work it was made in response to.
 */
export class LamportClock {
	private counter = 0;

	constructor(readonly actor: string) {}

	observe(stamp: Stamp) {
		this.counter = Math.max(this.counter, stamp.counter);
	}

	next(): Stamp {
		this.counter += 1;
		return { counter: this.counter, actor: this.actor };
	}

	/** Only for restoring a clock alongside state that was already stamped. */
	get value() {
		return this.counter;
	}
}

/**
 * Merge two stamp-keyed records, keeping the later value for each key.
 *
 * Keys present on one side only are kept: an independent edit is not a conflict.
 */
export function mergeStampedRecords<Value>(
	left: Record<string, StampedValue<Value>>,
	right: Record<string, StampedValue<Value>>,
): Record<string, StampedValue<Value>> {
	const merged: Record<string, StampedValue<Value>> = { ...left };
	for (const [key, value] of Object.entries(right)) {
		const existing = merged[key];
		merged[key] = existing ? mergeStamped(existing, value) : value;
	}
	return merged;
}

export function isStamp(value: unknown): value is Stamp {
	return stampSchema.safeParse(value).success;
}
