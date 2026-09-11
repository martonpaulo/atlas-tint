import { Button } from "@atlas-tint/ui/components/button";
import { Input } from "@atlas-tint/ui/components/input";
import {
	Ban,
	Check,
	LocateFixed,
	Search,
	SlidersHorizontal,
	Undo2,
	X,
} from "lucide-react";
import {
	type KeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import {
	createChronologyContext,
	defaultCustomColor,
	fillModeLabels,
	type ResolvedColor,
	resolveEntityColor,
} from "@/features/atlas/colors";
import { DataActions } from "@/features/atlas/components/data-actions";
import {
	type EntityManifest,
	fillModeSchema,
	type LoadedPreset,
	type ParentManifest,
} from "@/features/atlas/domain";
import type { SelectionMetadata } from "@/features/atlas/persistence-schema";
import { formatPercentage } from "@/features/atlas/progress";
import { searchEntities } from "@/features/atlas/search";
import { getParentSelectionState } from "@/features/atlas/selection";
import {
	countSelectable,
	createSelectionPolicy,
	isSelectable,
	selectableChildren,
} from "@/features/atlas/selection-policy";
import { useAtlasStore } from "@/features/atlas/store";

interface AtlasSidebarProps {
	preset: LoadedPreset;
	focusedEntityId?: string;
	onFocusEntity: (id: string | undefined) => void;
}

function ParentCheckbox({
	parent,
	childIds,
	selected,
	onChange,
}: {
	parent: ParentManifest;
	/** Only the children the manifest allows selecting; the rest are not this group's business. */
	childIds: readonly string[];
	selected: Record<string, SelectionMetadata>;
	onChange: (value: boolean) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const state = getParentSelectionState(
		{ ...parent, childIds: [...childIds] },
		selected,
	);
	useEffect(() => {
		if (inputRef.current) inputRef.current.indeterminate = state === "mixed";
	}, [state]);
	const selectedCount = childIds.filter((id) => selected[id]).length;
	return (
		<label className="focus-ring-within focus-ring-sidebar group flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-xs hover:bg-sidebar-accent">
			<input
				ref={inputRef}
				type="checkbox"
				checked={state === "all"}
				onChange={(event) => onChange(event.target.checked)}
				className="size-4 rounded border-sidebar-border accent-primary"
				aria-label={`${parent.name}, ${selectedCount} of ${childIds.length} selected`}
			/>
			<span className="min-w-0 flex-1 truncate font-medium">{parent.name}</span>
			<span className="text-muted-foreground tabular-nums">
				{selectedCount}/{childIds.length}
			</span>
		</label>
	);
}

function EntityRow({
	entity,
	selectable,
	selected,
	active,
	mapFocused,
	tabbable,
	customMode,
	resolvedColor,
	registerRow,
	onToggle,
	onLocate,
	onColor,
	onKeyDown,
}: {
	entity: EntityManifest;
	/** The manifest allows selecting this region. Visible does not imply selectable. */
	selectable: boolean;
	selected: boolean;
	/** The roving-focus target: where ArrowUp/ArrowDown will land. Not map focus. */
	active: boolean;
	/** The map is actually showing this entity, which is what Locate reports. */
	mapFocused: boolean;
	tabbable: boolean;
	customMode: boolean;
	/** The colour this region actually renders in, and whether it is inherited or chosen. */
	resolvedColor?: ResolvedColor;
	registerRow: (id: string, element: HTMLButtonElement | null) => void;
	onToggle: () => void;
	onLocate: () => void;
	onColor: (value: string | undefined) => void;
	onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}) {
	const tabIndex = tabbable ? 0 : -1;
	return (
		<li
			className="group grid grid-cols-[minmax(0,1fr)_auto] items-center rounded-md border-sidebar-border/60 border-b last:border-0 data-[active=true]:bg-sidebar-accent/60"
			data-active={active}
			data-unavailable={selectable ? undefined : ""}
		>
			<button
				ref={(element) => registerRow(entity.id, element)}
				type="button"
				className="focus-ring focus-ring-sidebar flex min-w-0 items-center gap-3 rounded-md px-2.5 py-2.5 text-left hover:bg-sidebar-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent data-[selected=true]:font-medium"
				data-selected={selected}
				aria-pressed={selectable ? selected : undefined}
				disabled={!selectable}
				tabIndex={tabIndex}
				onClick={onToggle}
				onKeyDown={onKeyDown}
			>
				<span
					className="grid size-5 shrink-0 place-items-center rounded-full border border-sidebar-border bg-background text-primary data-[selected=true]:border-primary data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground group-data-[unavailable]:border-dashed"
					data-selected={selected}
					aria-hidden="true"
				>
					{selectable ? (
						selected ? (
							<Check className="size-3" />
						) : null
					) : (
						<Ban className="size-3 text-muted-foreground" />
					)}
				</span>
				<span className="min-w-0">
					<span className="block truncate text-list-primary">
						{entity.name}
						{selectable ? null : (
							<span className="ml-1.5 rounded-sm border border-sidebar-border px-1 py-px align-middle text-eyebrow text-muted-foreground">
								Unavailable
							</span>
						)}
					</span>
					<span className="mt-0.5 block truncate text-metadata text-muted-foreground">
						{entity.codes.join(" · ")} · {entity.groupName}
					</span>
				</span>
			</button>
			<div className="flex items-center gap-1 pr-1.5">
				{customMode && selected && selectable && resolvedColor ? (
					resolvedColor.source === "custom" ? (
						<>
							<input
								type="color"
								aria-label={`Custom color for ${entity.name}`}
								className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
								value={resolvedColor.value}
								tabIndex={tabIndex}
								onChange={(event) => onColor(event.target.value)}
								onKeyDown={onKeyDown}
							/>
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label={`Use the inherited color for ${entity.name}`}
								tabIndex={tabIndex}
								onClick={() => onColor(undefined)}
								onKeyDown={onKeyDown}
							>
								<Undo2 />
							</Button>
						</>
					) : (
						// A native colour input cannot encode the inherited OKLCH value, so say it
						// is inherited and show the colour actually rendered, rather than invent a
						// hex the map does not use.
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label={`Set a custom color for ${entity.name}, currently inherited`}
							tabIndex={tabIndex}
							onClick={() => onColor(defaultCustomColor)}
							onKeyDown={onKeyDown}
						>
							<span
								className="size-3.5 rounded-full border border-sidebar-border border-dashed"
								style={{ background: resolvedColor.value }}
								aria-hidden="true"
							/>
						</Button>
					)
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
	preset,
	focusedEntityId,
	onFocusEntity,
}: AtlasSidebarProps) {
	const { manifest, groupHues } = preset;
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
	const policy = createSelectionPolicy(manifest);
	const chronology = useMemo(
		() => createChronologyContext(progress.selected),
		[progress.selected],
	);
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<"all" | "selected">("all");
	// Roving focus is keyed by stable entity ID, never by index: sorting, filtering, and
	// preset changes reorder the list and an index would point at the wrong region.
	const [activeEntityId, setActiveEntityId] = useState<string>();
	const rowRefs = useRef(new Map<string, HTMLButtonElement>());
	const searchRef = useRef<HTMLInputElement>(null);
	// Progress is what the manifest says is selectable, never what happens to be stored.
	const selectedCount = countSelectable(policy, progress.selected);
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

	/**
	 * Announced only once typing settles, so a nine-character query produces one message rather
	 * than nine. Kept apart from the selection announcement so neither overwrites the other.
	 */
	const [resultAnnouncement, setResultAnnouncement] = useState("");
	useEffect(() => {
		const filterName = filter === "all" ? "All regions" : "Selected regions";
		const settle = setTimeout(
			() =>
				setResultAnnouncement(
					`${filterName}: ${entities.length} ${entities.length === 1 ? "result" : "results"}${query ? ` for ${query}` : ""}.`,
				),
			400,
		);
		return () => clearTimeout(settle);
	}, [entities.length, filter, query]);

	/**
	 * Why the list is empty, and what would actually fix it.
	 *
	 * One generic "No regions found. Try another name, alias, code, or filter." could not name
	 * the recovery action, and an empty Selected view is not a failed search.
	 */
	const emptyState = (() => {
		const clearSearch = { label: "Clear search", run: () => setQuery("") };
		const showAll = { label: "Show all", run: () => setFilter("all") };
		if (filter === "selected" && query)
			return {
				title: "No selected regions match the query",
				description: `Nothing you have selected matches “${query}”.`,
				actions: [clearSearch, showAll],
			};
		if (filter === "selected")
			return {
				title: "No selected regions",
				description: "Choose All to find and mark a region.",
				actions: [showAll],
			};
		return {
			title: "No regions match the query",
			description: `Nothing matches “${query}”. Try another name, alias, or code.`,
			actions: [clearSearch],
		};
	})();

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
		// The store refuses anyway; stopping here keeps the announcement honest too.
		if (!isSelectable(policy, entity.id)) return;
		toggleEntity(policy, entity.id, entity.name);
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
						<p className="text-metadata text-muted-foreground tabular-nums">
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
							className="h-10 pr-9 pl-9"
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
								aria-label="Clear search box"
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
									// A two-state toggle group: exactly one is pressed, and native
									// button keyboard behaviour is preserved.
									aria-pressed={filter === value}
									className="focus-ring focus-ring-sidebar rounded-sm px-2.5 py-1.5 text-field-label text-muted-foreground capitalize hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-field"
									onClick={() => setFilter(value)}
								>
									{value}
								</button>
							))}
						</fieldset>
						<span
							className="text-metadata text-muted-foreground tabular-nums"
							aria-hidden="true"
						>
							{entities.length} shown
						</span>
					</div>

					{manifest.parents.length > 0 && !query && filter === "all" ? (
						<details className="mt-3 rounded-md border border-sidebar-border bg-background/35">
							<summary className="focus-ring focus-ring-sidebar cursor-pointer px-3 py-2.5 font-medium text-xs">
								Select groups
							</summary>
							<div className="max-h-48 overflow-y-auto border-sidebar-border border-t p-1">
								{manifest.parents.map((parent) => (
									<ParentCheckbox
										key={parent.id}
										parent={parent}
										childIds={selectableChildren(policy, parent)}
										selected={progress.selected}
										onChange={(value) => setParent(policy, parent, value)}
									/>
								))}
							</div>
						</details>
					) : null}
				</section>
			</div>

			<p className="sr-only" aria-live="polite" aria-atomic="true">
				{resultAnnouncement}
			</p>

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
								selectable={isSelectable(policy, entity.id)}
								selected={progress.selected[entity.id] !== undefined}
								active={activeEntityId === entity.id}
								mapFocused={focusedEntityId === entity.id}
								tabbable={tabbableId === entity.id}
								customMode={progress.fillMode === "custom"}
								resolvedColor={
									progress.selected[entity.id] !== undefined
										? resolveEntityColor(
												entity,
												progress.fillMode,
												progress,
												chronology,
												groupHues,
											)
										: undefined
								}
								registerRow={registerRow}
								onToggle={() => toggleEntity(policy, entity.id, entity.name)}
								onLocate={() =>
									onFocusEntity(
										focusedEntityId === entity.id ? undefined : entity.id,
									)
								}
								onColor={(color) => setCustomColor(policy, entity.id, color)}
								onKeyDown={handleRowKeys}
							/>
						))}
					</ul>
				) : (
					<div className="px-4 py-10 text-center">
						<p className="font-medium text-sm">{emptyState.title}</p>
						<p className="mt-1 text-muted-foreground text-xs leading-5">
							{emptyState.description}
						</p>
						<div className="mt-4 flex flex-wrap justify-center gap-2">
							{emptyState.actions.map((action) => (
								<Button
									key={action.label}
									variant="outline"
									onClick={action.run}
								>
									{action.label}
								</Button>
							))}
						</div>
					</div>
				)}
			</div>

			<details className="settings-disclosure border-sidebar-border border-t bg-background/25">
				<summary className="focus-ring focus-ring-sidebar flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium text-xs">
					<SlidersHorizontal
						className="size-4 text-muted-foreground"
						aria-hidden="true"
					/>
					<span>Style & data</span>
				</summary>
				<div className="border-sidebar-border border-t px-4 py-3">
					<label className="grid gap-1.5 text-field-label text-muted-foreground">
						Color mode
						<select
							className="atlas-select focus-ring"
							data-variant="field"
							value={progress.fillMode}
							onChange={(event) => {
								const mode = fillModeSchema.safeParse(event.target.value);
								if (mode.success) setFillMode(manifest.id, mode.data);
							}}
							aria-label="Selected region color mode"
						>
							{fillModeSchema.options.map((mode) => (
								<option key={mode} value={mode}>
									{fillModeLabels[mode]}
								</option>
							))}
						</select>
					</label>
					<DataActions presetId={manifest.id} presetName={manifest.shortName} />
				</div>
			</details>
		</aside>
	);
}
