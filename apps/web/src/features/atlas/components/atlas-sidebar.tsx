import { Button } from "@atlas-tint/ui/components/button";
import { Input } from "@atlas-tint/ui/components/input";
import { Check, LocateFixed, Search, SlidersHorizontal, X } from "lucide-react";
import {
	type KeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { DataActions } from "@/features/atlas/components/data-actions";
import {
	type EntityManifest,
	fillModeSchema,
	type ParentManifest,
	type PresetManifest,
} from "@/features/atlas/domain";
import type { SelectionMetadata } from "@/features/atlas/persistence-schema";
import { formatPercentage } from "@/features/atlas/progress";
import { searchEntities } from "@/features/atlas/search";
import { getParentSelectionState } from "@/features/atlas/selection";
import { useAtlasStore } from "@/features/atlas/store";

interface AtlasSidebarProps {
	manifest: PresetManifest;
	focusedEntityId?: string;
	onFocusEntity: (id: string | undefined) => void;
}

function ParentCheckbox({
	parent,
	selected,
	onChange,
}: {
	parent: ParentManifest;
	selected: Record<string, SelectionMetadata>;
	onChange: (value: boolean) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const state = getParentSelectionState(parent, selected);
	useEffect(() => {
		if (inputRef.current) inputRef.current.indeterminate = state === "mixed";
	}, [state]);
	const selectedCount = parent.childIds.filter((id) => selected[id]).length;
	return (
		<label className="group flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-xs focus-within:ring-2 focus-within:ring-sidebar-ring hover:bg-sidebar-accent">
			<input
				ref={inputRef}
				type="checkbox"
				checked={state === "all"}
				onChange={(event) => onChange(event.target.checked)}
				className="size-4 rounded border-sidebar-border accent-primary"
				aria-label={`${parent.name}, ${selectedCount} of ${parent.childIds.length} selected`}
			/>
			<span className="min-w-0 flex-1 truncate font-medium">{parent.name}</span>
			<span className="text-muted-foreground tabular-nums">
				{selectedCount}/{parent.childIds.length}
			</span>
		</label>
	);
}

function EntityRow({
	entity,
	selected,
	focused,
	customMode,
	customColor,
	onToggle,
	onFocus,
	onColor,
}: {
	entity: EntityManifest;
	selected: boolean;
	focused: boolean;
	customMode: boolean;
	customColor?: string;
	onToggle: () => void;
	onFocus: () => void;
	onColor: (value: string) => void;
}) {
	return (
		<li
			id={`entity-option-${entity.id}`}
			className="group grid grid-cols-[minmax(0,1fr)_auto] items-center border-sidebar-border/60 border-b last:border-0"
			data-focused={focused || undefined}
		>
			<button
				type="button"
				className="flex min-w-0 items-center gap-3 rounded-md px-2.5 py-2.5 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[selected=true]:font-medium"
				data-selected={selected}
				aria-pressed={selected}
				onClick={onToggle}
			>
				<span
					className="grid size-5 shrink-0 place-items-center rounded-full border border-sidebar-border bg-background text-primary data-[selected=true]:border-primary data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
					data-selected={selected}
					aria-hidden="true"
				>
					{selected ? <Check className="size-3" /> : null}
				</span>
				<span className="min-w-0">
					<span className="block truncate text-[13px]">{entity.name}</span>
					<span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
						{entity.codes.join(" · ")} · {entity.groupName}
					</span>
				</span>
			</button>
			<div className="flex items-center gap-1 pr-1.5">
				{customMode && selected ? (
					<input
						type="color"
						aria-label={`Custom color for ${entity.name}`}
						className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
						value={customColor ?? "#b86b45"}
						onChange={(event) => onColor(event.target.value)}
					/>
				) : null}
				<Button
					variant="ghost"
					size="icon-xs"
					className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 data-[pressed=true]:opacity-100"
					data-pressed={focused || undefined}
					aria-label={`Locate ${entity.name} on map`}
					aria-pressed={focused}
					onClick={onFocus}
				>
					<LocateFixed />
				</Button>
			</div>
		</li>
	);
}

export function AtlasSidebar({
	manifest,
	focusedEntityId,
	onFocusEntity,
}: AtlasSidebarProps) {
	const progress = useAtlasStore(({ data }) => data.presets[manifest.id]);
	const toggleEntity = useAtlasStore(({ toggleEntity: toggle }) => toggle);
	const setParent = useAtlasStore(
		({ setParent: updateParent }) => updateParent,
	);
	const setFillMode = useAtlasStore(
		({ setFillMode: updateFillMode }) => updateFillMode,
	);
	const setCustomColor = useAtlasStore(
		({ setCustomColor: updateColor }) => updateColor,
	);
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<"all" | "selected">("all");
	const [activeIndex, setActiveIndex] = useState(0);
	const selectedCount = Object.keys(progress.selected).length;
	const percentage = formatPercentage(selectedCount, manifest.primaryTotal);
	const entities = useMemo(() => {
		const searched = searchEntities(
			manifest.entities,
			query,
			manifest.entities.length,
		);
		return filter === "selected"
			? searched.filter(({ id }) => progress.selected[id])
			: searched;
	}, [filter, manifest.entities, progress.selected, query]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: these values intentionally reset keyboard focus when the result set changes.
	useEffect(() => setActiveIndex(0), [query, filter, manifest.id]);

	const handleSearchKeys = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((index) =>
				Math.min(Math.max(entities.length - 1, 0), index + 1),
			);
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((index) => Math.max(0, index - 1));
		}
		if (event.key === "Enter") {
			const entity = entities[activeIndex];
			if (!entity) return;
			event.preventDefault();
			toggleEntity(manifest.id, entity.id, entity.name);
			onFocusEntity(entity.id);
		}
		if (event.key === "Escape") {
			setQuery("");
			onFocusEntity(undefined);
		}
	};

	return (
		<aside
			className="flex min-h-0 flex-col border-sidebar-border border-r bg-sidebar text-sidebar-foreground"
			aria-label="Atlas controls"
		>
			<div className="border-sidebar-border border-b p-4">
				<section aria-labelledby="progress-title">
					<div className="flex items-baseline justify-between gap-4">
						<h2 id="progress-title" className="font-semibold text-sm">
							Regions
						</h2>
						<p className="text-muted-foreground text-xs tabular-nums">
							<strong className="font-semibold text-foreground">
								{selectedCount}
							</strong>{" "}
							/ {manifest.primaryTotal}
							<span className="mx-1.5" aria-hidden="true">
								·
							</span>
							{percentage}
						</p>
					</div>
					<progress
						className="atlas-progress mt-2 h-1.5 w-full"
						value={selectedCount}
						max={manifest.primaryTotal}
						aria-label={`${selectedCount} of ${manifest.primaryTotal} regions selected, ${percentage}`}
					/>

					<div className="relative mt-4">
						<Search
							className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<Input
							className="h-10 pr-9 pl-9 text-[13px]"
							placeholder="Search regions"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							onKeyDown={handleSearchKeys}
							role="searchbox"
							aria-label="Search names, aliases, or codes"
							aria-controls="entity-results"
							aria-activedescendant={
								entities[activeIndex]
									? `entity-option-${entities[activeIndex].id}`
									: undefined
							}
						/>
						{query ? (
							<Button
								variant="ghost"
								size="icon-xs"
								className="absolute top-1/2 right-1.5 -translate-y-1/2"
								aria-label="Clear search"
								onClick={() => setQuery("")}
							>
								<X />
							</Button>
						) : null}
					</div>

					<div className="mt-3 flex items-center justify-between gap-3">
						<fieldset className="flex rounded-md bg-background/55 p-0.5">
							<legend className="sr-only">Region filter</legend>
							{(["all", "selected"] as const).map((value) => (
								<button
									key={value}
									type="button"
									className="rounded-sm px-2.5 py-1.5 font-medium text-[11px] text-muted-foreground capitalize outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-xs"
									data-active={filter === value}
									onClick={() => setFilter(value)}
								>
									{value}
								</button>
							))}
						</fieldset>
						<span className="text-[11px] text-muted-foreground tabular-nums">
							{entities.length} shown
						</span>
					</div>

					{manifest.parents.length > 0 && !query && filter === "all" ? (
						<details className="mt-3 rounded-md border border-sidebar-border bg-background/35">
							<summary className="cursor-pointer px-3 py-2.5 font-medium text-xs outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
								Select groups
							</summary>
							<div className="max-h-48 overflow-y-auto border-sidebar-border border-t p-1">
								{manifest.parents.map((parent) => (
									<ParentCheckbox
										key={parent.id}
										parent={parent}
										selected={progress.selected}
										onChange={(value) => setParent(manifest.id, parent, value)}
									/>
								))}
							</div>
						</details>
					) : null}
				</section>
			</div>

			<div className="min-h-0 flex-1 overflow-hidden px-2">
				{entities.length > 0 ? (
					<ul
						id="entity-results"
						className="size-full overflow-y-auto p-1"
						aria-label="Selectable regions"
					>
						{entities.map((entity, index) => (
							<EntityRow
								key={entity.id}
								entity={entity}
								selected={progress.selected[entity.id] !== undefined}
								focused={
									focusedEntityId === entity.id ||
									(activeIndex === index && query.length > 0)
								}
								customMode={progress.fillMode === "custom"}
								customColor={progress.customColors[entity.id]}
								onToggle={() =>
									toggleEntity(manifest.id, entity.id, entity.name)
								}
								onFocus={() =>
									onFocusEntity(
										focusedEntityId === entity.id ? undefined : entity.id,
									)
								}
								onColor={(color) =>
									setCustomColor(manifest.id, entity.id, color)
								}
							/>
						))}
					</ul>
				) : (
					<div className="px-4 py-10 text-center">
						<p className="font-medium text-sm">No regions found</p>
						<p className="mt-1 text-muted-foreground text-xs leading-5">
							Try another name, alias, code, or filter.
						</p>
					</div>
				)}
			</div>

			<details className="settings-disclosure border-sidebar-border border-t bg-background/25">
				<summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium text-xs outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
					<SlidersHorizontal
						className="size-4 text-muted-foreground"
						aria-hidden="true"
					/>
					<span>Style & data</span>
				</summary>
				<div className="border-sidebar-border border-t px-4 py-3">
					<label className="grid gap-1.5 font-medium text-[11px] text-muted-foreground">
						Color mode
						<select
							className="control-select text-foreground"
							value={progress.fillMode}
							onChange={(event) => {
								const mode = fillModeSchema.safeParse(event.target.value);
								if (mode.success) setFillMode(manifest.id, mode.data);
							}}
							aria-label="Selected region color mode"
						>
							<option value="hierarchical">Hierarchical palette</option>
							<option value="accent">Single accent</option>
							<option value="chronology">Visit chronology</option>
							<option value="custom">Custom per region</option>
						</select>
					</label>
					<DataActions presetId={manifest.id} presetName={manifest.shortName} />
				</div>
			</details>
		</aside>
	);
}
