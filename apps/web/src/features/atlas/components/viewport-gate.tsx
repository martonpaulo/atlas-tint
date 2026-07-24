import { MonitorUp } from "lucide-react";
import { type ReactNode, useSyncExternalStore } from "react";

const MINIMUM_WIDTH = 1024;
const MINIMUM_HEIGHT = 700;

function subscribeToViewport(onStoreChange: () => void) {
	window.addEventListener("resize", onStoreChange);
	return () => window.removeEventListener("resize", onStoreChange);
}

export function isSupportedViewport(width: number, height: number) {
	return width >= MINIMUM_WIDTH && height >= MINIMUM_HEIGHT;
}

function getViewportSnapshot() {
	return isSupportedViewport(window.innerWidth, window.innerHeight);
}

export function ViewportGate({ children }: { children: ReactNode }) {
	const supported = useSyncExternalStore(
		subscribeToViewport,
		getViewportSnapshot,
		() => false,
	);
	if (supported) return children;
	return (
		<main className="grid min-h-svh place-items-center bg-background px-8 text-foreground">
			<section
				className="max-w-xl text-center"
				aria-labelledby="viewport-title"
			>
				<div className="mx-auto mb-6 grid size-16 place-items-center rounded-xl border border-border bg-card text-primary shadow-sm">
					<MonitorUp className="size-7" aria-hidden="true" />
				</div>
				<p className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-[0.18em]">
					Desktop atlas
				</p>
				<h1
					id="viewport-title"
					className="font-semibold font-serif text-4xl tracking-tight"
				>
					Give the map more room
				</h1>
				<p className="mt-4 text-base text-muted-foreground leading-7">
					AtlasTint requires a browser window of at least 1024 × 700 CSS pixels.
					Enlarge this window or move it to a larger desktop display; the atlas
					will open automatically.
				</p>
				<p className="mt-6 text-muted-foreground text-sm">
					Your saved progress remains untouched.
				</p>
			</section>
		</main>
	);
}
