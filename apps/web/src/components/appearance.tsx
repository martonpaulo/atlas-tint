import { useEffect, useSyncExternalStore } from "react";

import type { ThemePreference } from "@/features/atlas/domain";
import { useAtlasStore } from "@/features/atlas/store";

/**
 * Appearance has exactly one durable authority: the versioned Atlas state.
 *
 * It used to have two. `themePreference` lived in the versioned record — which import, export,
 * and reset already carry — while `next-themes` independently persisted `atlas-tint:theme`.
 * The two could disagree at startup, after an import, after a reset, after malformed-state
 * recovery, or across tabs, and a mirroring effect papered over it in one direction only.
 *
 * This module applies the preference to the document and never persists anything.
 */

export type ResolvedAppearance = "light" | "dark";

const darkQuery = "(prefers-color-scheme: dark)";

function systemAppearance(): ResolvedAppearance {
	if (typeof window === "undefined" || !window.matchMedia) return "light";
	return window.matchMedia(darkQuery).matches ? "dark" : "light";
}

export function resolveAppearance(
	preference: ThemePreference,
): ResolvedAppearance {
	return preference === "system" ? systemAppearance() : preference;
}

/**
 * Swap the theme without animating every transition in the interface at once.
 *
 * Repainting the whole application through each element's own transition is both ugly and
 * measurably unstable — an open menu keeps moving while it happens.
 */
function withoutTransitions(swap: () => void) {
	const suppression = document.createElement("style");
	suppression.append(
		document.createTextNode(
			"*,*::before,*::after{transition:none!important;animation:none!important}",
		),
	);
	document.head.append(suppression);
	swap();
	// Read a layout property to force the swap to apply before transitions come back.
	void window.getComputedStyle(document.body).opacity;
	suppression.remove();
}

export function applyAppearance(resolved: ResolvedAppearance) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	if (root.classList.contains(resolved)) return;
	withoutTransitions(() => {
		root.classList.toggle("dark", resolved === "dark");
		root.classList.toggle("light", resolved === "light");
		root.style.colorScheme = resolved;
	});
}

function subscribeToSystemAppearance(onStoreChange: () => void) {
	if (typeof window === "undefined" || !window.matchMedia)
		return () => undefined;
	const media = window.matchMedia(darkQuery);
	media.addEventListener("change", onStoreChange);
	return () => media.removeEventListener("change", onStoreChange);
}

/**
 * What the document currently looks like: the stored preference, with `system` resolved through
 * the media query and kept in step when the operating system changes underneath.
 */
export function useAppearance(): ResolvedAppearance {
	const preference = useAtlasStore(({ data }) => data.themePreference);
	const system = useSyncExternalStore(
		subscribeToSystemAppearance,
		systemAppearance,
		() => "light" as const,
	);
	return preference === "system" ? system : preference;
}

/**
 * Applies the resolved appearance to the document. Renders nothing.
 *
 * In an effect, not during render: writing to `document` while rendering makes React's work
 * observable to the layout and left an open menu perpetually unstable.
 */
export function AppearanceBridge() {
	const resolved = useAppearance();
	useEffect(() => applyAppearance(resolved), [resolved]);
	return null;
}
