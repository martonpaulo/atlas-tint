import { Button } from "@atlas-tint/ui/components/button";
import { select } from "d3-selection";
import {
	type D3ZoomEvent,
	type ZoomBehavior,
	zoom,
	zoomIdentity,
} from "d3-zoom";
import { Check, LocateFixed, Minus, Plus, RotateCcw } from "lucide-react";
import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

import {
	createChronologyContext,
	resolveEntityColor,
	selectionOrderLegend,
} from "@/features/atlas/colors";
import { type LoadedPreset, projectionIdSchema } from "@/features/atlas/domain";
import type { GeometryBundle } from "@/features/atlas/geometry";
import { projectionLabel } from "@/features/atlas/projection-registry";
import {
	createProjectionLayout,
	zoomExtent,
	zoomTranslateExtent,
} from "@/features/atlas/projections";
import {
	countSelectable,
	createSelectionPolicy,
	isSelectable,
} from "@/features/atlas/selection-policy";
import { useAtlasStore } from "@/features/atlas/store";

interface MapWorkspaceProps {
	preset: LoadedPreset;
	geometry: GeometryBundle;
	focusedEntityId?: string;
	onFocusEntity: (id: string | undefined) => void;
}

function MapCanvas({
	preset,
	geometry,
	focusedEntityId,
	onFocusEntity,
}: MapWorkspaceProps) {
	const { manifest } = preset;
	const policy = createSelectionPolicy(manifest);
	const progress = useAtlasStore(({ data }) => data.presets[manifest.id]);
	const toggleEntity = useAtlasStore(({ toggleEntity: toggle }) => toggle);
	const projection = manifest.projections.includes(progress.projection)
		? progress.projection
		: manifest.defaultProjection;
	const layout = useMemo(
		() => createProjectionLayout(preset, projection, geometry),
		[geometry, preset, projection],
	);
	const renderedEntities = useMemo(
		() =>
			geometry.entities.features.map((feature) => ({
				feature,
				path: layout.pathForEntity(feature),
				centroid: layout.centroidFor(feature),
			})),
		[geometry.entities.features, layout],
	);
	// Built once per selection set instead of re-derived for every rendered entity.
	const chronology = useMemo(
		() => createChronologyContext(progress.selected),
		[progress.selected],
	);
	const renderedParents = useMemo(
		() =>
			geometry.parents.features.map((feature) => ({
				feature,
				path: layout.pathForParent(feature),
			})),
		[geometry.parents.features, layout],
	);
	const entityById = useMemo(
		() => new Map(manifest.entities.map((entity) => [entity.id, entity])),
		[manifest.entities],
	);
	const [hoveredEntityId, setHoveredEntityId] = useState<string>();
	const svgRef = useRef<SVGSVGElement>(null);
	const zoomGroupRef = useRef<SVGGElement>(null);
	const mapFrameRef = useRef<HTMLDivElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(
		null,
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: projection and geometry changes must recreate and reset the bounded zoom behavior.
	useEffect(() => {
		const svgElement = svgRef.current;
		if (!svgElement) return;
		const behavior = zoom<SVGSVGElement, unknown>()
			// Every one of these comes from the policy the projection fitting used.
			.scaleExtent([...layout.policy.zoom.scaleExtent])
			.extent(zoomExtent())
			.translateExtent(zoomTranslateExtent())
			.on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
				zoomGroupRef.current?.setAttribute(
					"transform",
					event.transform.toString(),
				);
			});
		zoomBehaviorRef.current = behavior;
		const svgSelection = select(svgElement);
		svgSelection.call(behavior).call(behavior.transform, zoomIdentity);
		return () => {
			svgSelection.on(".zoom", null);
		};
	}, [geometry, projection, layout]);

	const zoomBy = (factor: number) => {
		if (!svgRef.current || !zoomBehaviorRef.current) return;
		select(svgRef.current).call(zoomBehaviorRef.current.scaleBy, factor);
	};

	const resetZoom = () => {
		if (!svgRef.current || !zoomBehaviorRef.current) return;
		select(svgRef.current).call(
			zoomBehaviorRef.current.transform,
			zoomIdentity,
		);
	};

	const moveTooltip = (event: PointerEvent<SVGPathElement>) => {
		const frame = mapFrameRef.current;
		const tooltip = tooltipRef.current;
		if (!frame || !tooltip) return;
		const bounds = frame.getBoundingClientRect();
		const x = Math.min(
			Math.max(event.clientX - bounds.left + 12, 8),
			Math.max(8, bounds.width - 196),
		);
		const y = Math.min(
			Math.max(event.clientY - bounds.top + 12, 8),
			Math.max(8, bounds.height - 66),
		);
		tooltip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
	};

	const focusedGeometry = renderedEntities.find(
		({ feature }) => feature.properties.id === focusedEntityId,
	);
	const hoveredEntity = hoveredEntityId
		? entityById.get(hoveredEntityId)
		: undefined;

	return (
		<div
			ref={mapFrameRef}
			className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-map-border bg-map-surface shadow-map"
		>
			<svg
				ref={svgRef}
				viewBox={layout.viewBox}
				className="block size-full cursor-grab touch-none active:cursor-grabbing"
				role="img"
				aria-labelledby="atlas-map-title atlas-map-description"
				data-testid="atlas-map"
			>
				<title id="atlas-map-title">{manifest.name}</title>
				<desc id="atlas-map-description">
					Interactive map of {manifest.primaryTotal} selectable regions. Use the
					adjacent searchable list for full keyboard access.
				</desc>
				<defs>
					{/* Unavailable geography is hatched rather than only tinted, so it stays
					    distinguishable without relying on colour. */}
					<pattern
						id="map-unavailable-hatch"
						patternUnits="userSpaceOnUse"
						width="6"
						height="6"
						patternTransform="rotate(45)"
					>
						<rect width="6" height="6" fill="var(--map-fill-unavailable)" />
						<line
							x1="0"
							y1="0"
							x2="0"
							y2="6"
							stroke="var(--map-unavailable-hatch)"
							strokeWidth="1.5"
						/>
					</pattern>
				</defs>
				<g ref={zoomGroupRef}>
					{preset.insets.map((inset) => (
						<g key={inset.key} className="map-inset-frame">
							<rect
								x={inset.x}
								y={inset.y}
								width={inset.width}
								height={inset.height}
							/>
							<text x={inset.x + inset.padding} y={inset.y + 26}>
								{inset.label}
							</text>
						</g>
					))}
					<g>
						{renderedEntities.map(({ feature, path }) => {
							const entity = entityById.get(feature.properties.id);
							if (!entity) return null;
							const selected = progress.selected[entity.id] !== undefined;
							const focused = focusedEntityId === entity.id;
							const selectable = isSelectable(policy, entity.id);
							return (
								// biome-ignore lint/a11y/noAriaHiddenOnFocusable: map paths are pointer-only, explicitly unfocusable, and have equivalent list buttons.
								<path
									key={entity.id}
									d={path}
									className="map-entity"
									data-entity-id={entity.id}
									data-selected={selected || undefined}
									data-focused={focused || undefined}
									data-unavailable={selectable ? undefined : ""}
									aria-hidden="true"
									focusable="false"
									vectorEffect="non-scaling-stroke"
									style={{
										fill: selectable
											? selected
												? resolveEntityColor(
														entity,
														progress.fillMode,
														progress,
														chronology,
														preset.groupHues,
													).value
												: "var(--map-fill-unselected)"
											: // A hatch, not merely another colour, so unavailable geography reads as
												// unavailable without depending on colour perception.
												"url(#map-unavailable-hatch)",
									}}
									onPointerEnter={() => setHoveredEntityId(entity.id)}
									onPointerMove={moveTooltip}
									onPointerLeave={() => setHoveredEntityId(undefined)}
									onClick={
										selectable
											? () => {
													toggleEntity(policy, entity.id, entity.name);
													onFocusEntity(entity.id);
												}
											: undefined
									}
								/>
							);
						})}
					</g>
					<g className="map-parent-boundaries">
						{renderedParents.map(({ feature, path }) => (
							<path
								key={feature.properties.id}
								d={path}
								vectorEffect="non-scaling-stroke"
							/>
						))}
					</g>
					{focusedGeometry ? (
						<g
							className="map-focus-marker"
							transform={`translate(${focusedGeometry.centroid[0]} ${focusedGeometry.centroid[1]})`}
						>
							<circle r="9" vectorEffect="non-scaling-stroke" />
							<circle r="2.5" />
						</g>
					) : null}
				</g>
			</svg>

			<fieldset className="absolute top-3 right-3 grid gap-1 rounded-md border border-border bg-popover/95 p-1 shadow-md">
				<legend className="sr-only">Map zoom controls</legend>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Zoom in"
					onClick={() => zoomBy(1.5)}
				>
					<Plus />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Zoom out"
					onClick={() => zoomBy(1 / 1.5)}
				>
					<Minus />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Reset map view"
					onClick={resetZoom}
				>
					<RotateCcw />
				</Button>
			</fieldset>

			{focusedEntityId ? (
				<Button
					variant="outline"
					size="sm"
					className="absolute top-3 left-3 bg-popover/95 shadow-sm"
					onClick={() => onFocusEntity(undefined)}
				>
					<LocateFixed data-icon="inline-start" /> Clear focus
				</Button>
			) : null}

			<div
				ref={tooltipRef}
				className="pointer-events-none absolute top-0 left-0 z-20 min-w-40 rounded-md border border-tooltip-border bg-tooltip-surface px-3 py-2 text-tooltip-foreground text-xs opacity-0 shadow-lg transition-opacity data-[visible=true]:opacity-100"
				data-visible={hoveredEntity !== undefined}
				aria-hidden="true"
			>
				{hoveredEntity ? (
					<>
						<strong className="block font-medium">{hoveredEntity.name}</strong>
						<span className="mt-0.5 block text-[10px] opacity-70">
							{hoveredEntity.groupName} · click to{" "}
							{progress.selected[hoveredEntity.id] ? "deselect" : "select"}
						</span>
					</>
				) : null}
			</div>
		</div>
	);
}

export function MapWorkspace(props: MapWorkspaceProps) {
	const { manifest } = props.preset;
	const progress = useAtlasStore(({ data }) => data.presets[manifest.id]);
	const setProjection = useAtlasStore(
		({ setProjection: updateProjection }) => updateProjection,
	);
	const selectedCount = countSelectable(
		createSelectionPolicy(manifest),
		progress.selected,
	);
	const fillMode = progress.fillMode;
	const projection = manifest.projections.includes(progress.projection)
		? progress.projection
		: manifest.defaultProjection;
	return (
		<main
			className="flex min-h-0 flex-col bg-map-canvas p-4"
			aria-label={`${manifest.shortName} map workspace`}
		>
			<header className="flex min-h-16 items-center justify-between gap-6 px-1 pb-3">
				<div>
					<h1 className="font-semibold font-serif text-2xl tracking-tight">
						{manifest.name}
					</h1>
					<p className="mt-0.5 max-w-2xl text-muted-foreground text-xs leading-5">
						{manifest.description}
					</p>
				</div>
				{manifest.projections.length > 1 ? (
					<label className="grid gap-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
						Projection
						<select
							className="atlas-select focus-ring min-w-40 normal-case tracking-normal"
							data-variant="field"
							value={projection}
							onChange={(event) => {
								const parsed = projectionIdSchema.safeParse(event.target.value);
								if (parsed.success) setProjection(manifest.id, parsed.data);
							}}
						>
							{manifest.projections.map((id) => (
								<option key={id} value={id}>
									{projectionLabel(id)}
								</option>
							))}
						</select>
					</label>
				) : null}
			</header>

			<MapCanvas {...props} />

			<footer className="flex min-h-8 items-center justify-between gap-6 px-1 pt-2 text-[11px] text-muted-foreground">
				<div className="flex flex-wrap items-center gap-4">
					<span className="sr-only">Map legend:</span>
					<span className="inline-flex items-center gap-1.5">
						<i className="legend-swatch bg-map-unselected" /> Unselected
					</span>
					{fillMode === "chronology" ? (
						// Direction stated in words, so the gradient is not the only way to read it.
						<span className="inline-flex items-center gap-1.5">
							{selectionOrderLegend.earliest}
							<i className="legend-scale" aria-hidden="true" />
							{selectionOrderLegend.latest}
						</span>
					) : (
						<span className="inline-flex items-center gap-1.5">
							<Check className="size-3.5 text-primary" aria-hidden="true" />
							Selected
						</span>
					)}
					<span className="inline-flex items-center gap-1.5">
						<i className="legend-focus" /> Focused
					</span>
					<span className="tabular-nums">{selectedCount} marked</span>
				</div>
				<p className="text-right">{props.preset.attribution}</p>
			</footer>
		</main>
	);
}
