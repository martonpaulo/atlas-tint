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
	active,
	mapFocused,
	tabbable,
	customMode,
	customColor,
	registerRow,
	onToggle,
	onLocate,
	onColor,
	onKeyDown,
}: {
	entity: EntityManifest;
	selected: boolean;
	/** The roving-focus target: where ArrowUp/ArrowDown will land. Not map focus. */
	active: boolean;
	/** The map is actually showing this entity, which is what Locate reports. */
	mapFocused: boolean;
	tabbable: boolean;
	customMode: boolean;
	customColor?: string;
	registerRow: (id: string, element: HTMLButtonElement | null) => void;
	onToggle: () => void;
	onLocate: () => void;
	onColor: (value: string) => void;
	onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}) {
	const tabIndex = tabbable ? 0 : -1;
	return (
		<li
			className="group grid grid-cols-[minmax(0,1fr)_auto] items-center rounded-md border-sidebar-border/60 border-b last:border-0 data-[active=true]:bg-sidebar-accent/60"
			data-active={active}
		>
			<button
				ref={(element) => registerRow(entity.id, element)}
				type="button"
				className="flex min-w-0 items-center gap-3 rounded-md px-2.5 py-2.5 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[selected=true]:font-medium"
				data-selected={selected}
				aria-pressed={selected}
				tabIndex={tabIndex}
				onClick={onToggle}
				onKeyDown={onKeyDown}
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
						tabIndex={tabIndex}
						onChange={(event) => onColor(event.target.value)}
						onKeyDown={onKeyDown}
					/>
				) : null}
				<Button
					variant="ghost"
					size="icon-xs"
					className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 data-[pressed=true]:opacity-100"
					data-pressed={mapFocused || undefined}
					aria-label={`Locate ${entity.name} on map`}
					aria-pressed={mapFocused}
					tabIndex={tabIndex}
					onClick={onLocate}
					onKeyDown={onKeyDown}
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
	// Roving focus is keyed by stable entity ID, never by index: sorting, filtering, and
	// preset changes reorder the list and an index would point at the wrong region.
	const [activeEntityId, setActiveEntityId] = useState<string>();
	const rowRefs = useRef(new Map<string, HTMLButtonElement>());
	const searchRef = useRef<HTMLInputElement>(null);
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: these values intentionally reset keyboard navigation when the result set changes.
	useEffect(() => setActiveEntityId(undefined), [query, filter, manifest.id]);

	const activeIndex = entities.findIndex(({ id }) => id === activeEntityId);
	// Exactly one row is reachable with Tab, so Tab and Shift+Tab step over the whole
	// result set instead of walking hundreds of region controls.
	const tabbableId = activeIndex >= 0 ? activeEntityId : entities[0]?.id;

	const registerRow = (id: string, element: HTMLButtonElement | null) => {
		if (element) rowRefs.current.set(id, element);
		else rowRefs.current.delete(id);
	};

	const focusRow = (id: string | undefined) => {
		if (!id) return;
		setActiveEntityId(id);
		const row = rowRefs.current.get(id);
		row?.focus();
		row?.scrollIntoView({ block: "nearest" });
	};

	const returnToSearch = () => {
		setActiveEntityId(undefined);
		searchRef.current?.focus();
	};

	const clearSearch = () => {
		setQuery("");
		setActiveEntityId(undefined);
		onFocusEntity(undefined);
	};

	const toggleFromKeyboard = (entity: EntityManifest) => {
		toggleEntity(manifest.id, entity.id, entity.name);
	};

	const handleSearchKeys = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			focusRow(entities[0]?.id);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			focusRow(entities.at(-1)?.id);
			return;
		}
		if (event.key === "Enter") {
			const entity = entities[0];
			if (!entity) return;
			event.preventDefault();
			toggleFromKeyboard(entity);
			// Enter is a deliberate activation, so it may move the map. Arrow navigation alone
			// never does, which keeps Locate's pressed state honest.
			onFocusEntity(entity.id);
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			clearSearch();
		}
	};

	const handleRowKeys = (event: KeyboardEvent<HTMLElement>) => {
		const index = entities.findIndex(({ id }) => id === activeEntityId);
		if (index < 0) return;
		if (event.key === "ArrowDown") {
			event.preventDefault();
			focusRow(entities[Math.min(index + 1, entities.length - 1)]?.id);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			if (index === 0) returnToSearch();
			else focusRow(entities[index - 1]?.id);
			return;
		}
		if (event.key === "Home") {
			event.preventDefault();
			focusRow(entities[0]?.id);
			return;
		}
		if (event.key === "End") {
			event.preventDefault();
			focusRow(entities.at(-1)?.id);
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			clearSearch();
			searchRef.current?.focus();
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
							ref={searchRef}
							className="h-10 pr-9 pl-9 text-[13px]"
							placeholder="Search regions"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							onKeyDown={handleSearchKeys}
							role="searchbox"
							aria-label="Search names, aliases, or codes"
							aria-controls="entity-results"
							aria-describedby="entity-results-help"
						/>
						{query ? (
							<Button
								variant="ghost"
								size="icon-xs"
								className="absolute top-1/2 right-1.5 -translate-y-1/2"
								aria-label="Clear search"
								onClick={clearSearch}
							>
								<X />
							</Button>
						) : null}
						<p id="entity-results-help" className="sr-only">
							Press Down Arrow to move into the results, Enter to select the
							first match, and Escape to clear the search. In the results, Up
							Arrow from the first region returns here, and Tab leaves the list.
						</p>
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
						{entities.map((entity) => (
							<EntityRow
								key={entity.id}
								entity={entity}
								selected={progress.selected[entity.id] !== undefined}
								active={activeEntityId === entity.id}
								mapFocused={focusedEntityId === entity.id}
								tabbable={tabbableId === entity.id}
								customMode={progress.fillMode === "custom"}
								customColor={progress.customColors[entity.id]}
								registerRow={registerRow}
								onToggle={() =>
									toggleEntity(manifest.id, entity.id, entity.name)
								}
								onLocate={() =>
									onFocusEntity(
										focusedEntityId === entity.id ? undefined : entity.id,
									)
								}
								onColor={(color) =>
									setCustomColor(manifest.id, entity.id, color)
								}
								onKeyDown={handleRowKeys}
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
