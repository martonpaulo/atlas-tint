import { Button } from "@atlas-tint/ui/components/button";
import { Skeleton } from "@atlas-tint/ui/components/skeleton";
import { AlertTriangle, MapIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { ModeToggle } from "@/components/mode-toggle";
import { validatePresetBundle } from "@/features/atlas/bundle";
import { AtlasSidebar } from "@/features/atlas/components/atlas-sidebar";
import { MapWorkspace } from "@/features/atlas/components/map-workspace";
import {
	PersistenceNotice,
	persistenceStatusLabel,
} from "@/features/atlas/components/persistence-notice";
import type { LoadedPreset } from "@/features/atlas/domain";
import {
	discardGeometry,
	type GeometryBundle,
	loadGeometry,
} from "@/features/atlas/geometry";
import {
	isAvailablePresetId,
	presetCatalog,
} from "@/features/atlas/preset-catalog";
import { loadPreset } from "@/features/atlas/preset-loader";
import { createSelectionPolicy } from "@/features/atlas/selection-policy";
import { useAtlasStore } from "@/features/atlas/store";

/**
 * One owner for the workspace shell geometry.
 *
 * Loading used a fixed 340px column while ready used a clamp, so the sidebar visibly jumped
 * the moment the map finished loading.
 */
const workspaceColumns =
	"grid min-h-0 grid-cols-[clamp(310px,24vw,336px)_minmax(0,1fr)]";

type PresetLoadState =
	| { status: "loading" }
	| { status: "ready"; preset: LoadedPreset; geometry: GeometryBundle }
	| { status: "error"; message: string; retryKey: number };

export function AtlasApp() {
	const activePresetId = useAtlasStore(({ data }) => data.activePresetId);
	const persistenceMode = useAtlasStore(({ persistenceMode: mode }) => mode);
	const announcement = useAtlasStore(({ announcement }) => announcement);
	const setActivePreset = useAtlasStore(
		({ setActivePreset: setPreset }) => setPreset,
	);
	const sanitizePreset = useAtlasStore(({ sanitizePreset }) => sanitizePreset);
	const [focusedEntityId, setFocusedEntityId] = useState<string>();
	const [retryKey, setRetryKey] = useState(0);
	const [loadState, setLoadState] = useState<PresetLoadState>({
		status: "loading",
	});

	useEffect(() => {
		const controller = new AbortController();
		setLoadState({ status: "loading" });
		setFocusedEntityId(undefined);
		void loadPreset(activePresetId)
			.then(async (preset) => ({
				preset,
				geometry: await loadGeometry(preset.geometryUrl, controller.signal),
			}))
			.then(({ preset, geometry }) => {
				if (controller.signal.aborted) return;
				// Manifest and topology are separate requests and can come from different builds.
				// Refuse a partial map rather than silently changing what is selectable.
				const validation = validatePresetBundle(preset.manifest, geometry);
				if (!validation.ok) {
					discardGeometry(preset.geometryUrl);
					setLoadState({
						status: "error",
						message: validation.message,
						retryKey,
					});
					return;
				}
				sanitizePreset(createSelectionPolicy(preset.manifest));
				setLoadState({ status: "ready", preset, geometry });
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				setLoadState({
					status: "error",
					message:
						error instanceof Error
							? error.message
							: "The preset could not be loaded.",
					retryKey,
				});
			});
		return () => controller.abort();
	}, [activePresetId, retryKey, sanitizePreset]);

	return (
		<div className="grid h-svh min-h-0 grid-rows-[52px_minmax(0,1fr)] overflow-hidden bg-background text-foreground">
			<header className="flex items-center justify-between border-border border-b bg-surface-raised px-4">
				<div className="flex min-w-0 items-center gap-6">
					<div className="flex shrink-0 items-center gap-2.5">
						<div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
							<MapIcon className="size-4" aria-hidden="true" />
						</div>
						<p className="font-semibold font-serif text-lg tracking-tight">
							AtlasTint
						</p>
					</div>
					<label className="flex min-w-0 items-center gap-2 text-field-label text-muted-foreground">
						<span className="sr-only">Map preset</span>
						<select
							className="atlas-select focus-ring"
							data-variant="toolbar"
							aria-label="Map preset"
							value={activePresetId}
							onChange={(event) => {
								if (isAvailablePresetId(event.target.value))
									setActivePreset(event.target.value);
							}}
						>
							{presetCatalog.map(({ id, label }) => (
								<option key={id} value={id}>
									{label}
								</option>
							))}
						</select>
					</label>
				</div>
				<div className="flex items-center gap-2">
					<span className="hidden text-muted-foreground text-xs 2xl:inline">
						{persistenceStatusLabel(persistenceMode)}
					</span>
					<ModeToggle />
				</div>
			</header>

			{loadState.status === "ready" ? (
				<div className={workspaceColumns}>
					<AtlasSidebar
						preset={loadState.preset}
						focusedEntityId={focusedEntityId}
						onFocusEntity={setFocusedEntityId}
					/>
					<MapWorkspace
						preset={loadState.preset}
						geometry={loadState.geometry}
						focusedEntityId={focusedEntityId}
						onFocusEntity={setFocusedEntityId}
					/>
				</div>
			) : loadState.status === "loading" ? (
				<div
					className={workspaceColumns}
					aria-label="Loading map preset"
					role="status"
				>
					<div className="border-border border-r bg-sidebar p-6">
						<Skeleton className="h-7 w-3/5" />
						<Skeleton className="mt-8 h-24" />
						<Skeleton className="mt-6 h-9" />
						<Skeleton className="mt-4 h-80" />
					</div>
					<div className="grid place-items-center bg-map-canvas">
						<div className="text-center">
							<div className="mx-auto size-8 animate-pulse rounded-full border-2 border-primary border-t-transparent" />
							<p className="mt-4 text-muted-foreground text-sm">
								Preparing the map…
							</p>
						</div>
					</div>
				</div>
			) : (
				<main className="grid min-h-0 place-items-center bg-map-canvas p-8">
					<section className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-card">
						<AlertTriangle
							className="mx-auto size-8 text-destructive"
							aria-hidden="true"
						/>
						<h1 className="mt-4 font-semibold font-serif text-2xl">
							The map did not load
						</h1>
						<p className="mt-2 text-muted-foreground text-sm leading-6">
							{loadState.message}
						</p>
						<Button
							className="mt-6"
							onClick={() => setRetryKey((value) => value + 1)}
						>
							Try again
						</Button>
					</section>
				</main>
			)}

			<PersistenceNotice />
			<p className="sr-only" aria-live="polite" aria-atomic="true">
				{announcement}
			</p>
		</div>
	);
}
