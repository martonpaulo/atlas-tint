import { Button, buttonVariants } from "@atlas-tint/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@atlas-tint/ui/components/dialog";
import { cn } from "@atlas-tint/ui/lib/utils";
import { Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";

import {
	importCopy,
	resetAllCopy,
	resetPresetCopy,
} from "@/features/atlas/destructive-copy";
import type { PresetId } from "@/features/atlas/domain";
import {
	countChanges,
	type ImportDifference,
	summarizeImport,
} from "@/features/atlas/import-diff";
import {
	type ImportPreview,
	serializeAtlasExport,
	validateImportText,
} from "@/features/atlas/import-export";
import { formatByteLimit, importLimits } from "@/features/atlas/import-limits";
import { loadAllManifests } from "@/features/atlas/preset-loader";
import { useAtlasStore } from "@/features/atlas/store";

type ResetScope = "preset" | "all";

export function DataActions({
	presetId,
	presetName,
}: {
	presetId: PresetId;
	presetName: string;
}) {
	const data = useAtlasStore(({ data: storeData }) => storeData);
	const replaceData = useAtlasStore(({ replaceData: replace }) => replace);
	const resetPreset = useAtlasStore(({ resetPreset: reset }) => reset);
	const resetAll = useAtlasStore(({ resetAll: reset }) => reset);
	const [resetScope, setResetScope] = useState<ResetScope>();
	const [preview, setPreview] = useState<ImportPreview>();
	const [importMessage, setImportMessage] = useState<string>();
	const [isImporting, setIsImporting] = useState(false);
	const [differences, setDifferences] = useState<ImportDifference[]>([]);
	// Base UI focuses the first tabbable element, which the reversed footer makes the
	// destructive one. An extra Enter would then commit deletion or replacement outright.
	const cancelResetRef = useRef<HTMLButtonElement>(null);
	const cancelImportRef = useRef<HTMLButtonElement>(null);
	/**
	 * Reading a file and loading the manifests are both async, so two choices can resolve out of
	 * order and a slower earlier file could replace the preview for a newer one. `File.text()`
	 * cannot be reliably aborted, so identify the latest operation instead of cancelling.
	 */
	const latestImport = useRef(0);

	const exportProgress = () => {
		const blob = new Blob([serializeAtlasExport(data)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `atlas-tint-progress-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(url);
	};

	const chooseImport = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;

		const operation = latestImport.current + 1;
		latestImport.current = operation;
		const isLatest = () => latestImport.current === operation;

		setPreview(undefined);
		// Reject before reading: an excessive file must never reach memory or the parser.
		if (file.size > importLimits.maxBytes) {
			setIsImporting(false);
			setImportMessage(
				`The selected file is ${formatByteLimit(file.size)}, over the ${formatByteLimit(importLimits.maxBytes)} import limit.`,
			);
			return;
		}

		setImportMessage(undefined);
		setIsImporting(true);
		try {
			const [text, manifests] = await Promise.all([
				file.text(),
				loadAllManifests(),
			]);
			if (!isLatest()) return;
			const result = validateImportText(text, manifests);
			if (!result.ok) {
				setImportMessage(result.message);
				return;
			}
			setDifferences(summarizeImport(data, result.preview.state, manifests));
			setPreview(result.preview);
		} catch (error) {
			if (!isLatest()) return;
			setImportMessage(
				error instanceof Error
					? error.message
					: "The import could not be read.",
			);
		} finally {
			if (isLatest()) setIsImporting(false);
		}
	};

	const confirmReset = () => {
		if (resetScope === "preset") resetPreset(presetId);
		if (resetScope === "all") resetAll();
		setResetScope(undefined);
	};

	const resetCopy =
		resetScope === "all" ? resetAllCopy : resetPresetCopy(presetName);
	const changedCount = countChanges(differences);
	const unknownCount = preview
		? Object.values(preview.unknownIds).reduce(
				(total, ids) => total + ids.length,
				0,
			)
		: 0;

	return (
		<section
			aria-labelledby="data-actions-title"
			aria-busy={isImporting}
			className="mt-3 border-sidebar-border border-t pt-3"
		>
			<div className="section-heading-row">
				<h2 id="data-actions-title" className="section-heading">
					Local data
				</h2>
			</div>
			<div className="grid grid-cols-2 gap-2">
				<Button variant="outline" onClick={exportProgress}>
					<Download data-icon="inline-start" /> Export
				</Button>
				{/*
				 * A label wrapping a real file input, not a Button: only a native input can open
				 * the file picker. It borrows the outline button recipe so it cannot drift away
				 * from the buttons beside it.
				 */}
				<label
					className={cn(
						buttonVariants({ variant: "outline" }),
						"focus-ring-within cursor-pointer has-disabled:cursor-not-allowed has-disabled:opacity-50",
					)}
				>
					<Upload className="size-4" aria-hidden="true" />{" "}
					{isImporting ? "Reading…" : "Import"}
					<input
						type="file"
						accept="application/json,.json"
						className="sr-only"
						aria-label="Import progress JSON"
						disabled={isImporting}
						onChange={chooseImport}
					/>
				</label>
				<Button variant="ghost" onClick={() => setResetScope("preset")}>
					<RotateCcw data-icon="inline-start" /> Reset preset
				</Button>
				<Button
					variant="ghost"
					className="text-destructive"
					onClick={() => setResetScope("all")}
				>
					<Trash2 data-icon="inline-start" /> Reset all
				</Button>
			</div>
			<p className="sr-only" role="status">
				{isImporting ? "Reading the selected progress file." : ""}
			</p>
			{importMessage ? (
				<p
					className="mt-3 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-destructive text-xs leading-5"
					role="alert"
				>
					{importMessage}
				</p>
			) : null}

			<Dialog
				open={resetScope !== undefined}
				onOpenChange={(open) => !open && setResetScope(undefined)}
			>
				<DialogContent initialFocus={cancelResetRef}>
					<DialogHeader>
						<DialogTitle>{resetCopy.title}</DialogTitle>
						<DialogDescription>{resetCopy.description}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="destructive" onClick={confirmReset}>
							{resetCopy.confirm}
						</Button>
						<Button
							ref={cancelResetRef}
							variant="outline"
							onClick={() => setResetScope(undefined)}
						>
							Cancel
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={preview !== undefined}
				onOpenChange={(open) => !open && setPreview(undefined)}
			>
				<DialogContent initialFocus={cancelImportRef}>
					<DialogHeader>
						<DialogTitle>{importCopy.title}</DialogTitle>
						<DialogDescription>{importCopy.description}</DialogDescription>
					</DialogHeader>
					{preview ? (
						<div className="mt-5 rounded-md border border-border bg-muted/40 text-sm">
							<table className="w-full border-collapse text-left">
								<caption className="sr-only">
									Every stored category, before and after this import
								</caption>
								<thead>
									<tr className="border-border border-b text-muted-foreground text-xs">
										<th scope="col" className="px-4 py-2 font-medium">
											Setting
										</th>
										<th scope="col" className="px-4 py-2 font-medium">
											Now
										</th>
										<th scope="col" className="px-4 py-2 font-medium">
											After import
										</th>
									</tr>
								</thead>
								<tbody>
									{differences.map((difference) => (
										<tr
											key={`${difference.scope}-${difference.label}`}
											className="border-border/60 border-b last:border-0 data-[changed=true]:font-medium"
											data-changed={difference.changed}
										>
											<th
												scope="row"
												className="px-4 py-2 font-normal text-muted-foreground text-xs"
											>
												{difference.scope} · {difference.label}
											</th>
											<td className="px-4 py-2 tabular-nums">
												{difference.current}
											</td>
											<td className="px-4 py-2 tabular-nums">
												{difference.incoming}
												{difference.changed ? (
													<span className="sr-only"> (changes)</span>
												) : null}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							<div className="border-border border-t px-4 py-3 text-muted-foreground text-xs">
								<p>
									{changedCount === 0
										? "Nothing would change."
										: `${changedCount} of ${differences.length} settings would change.`}
								</p>
								<p className="mt-1">
									Exported {new Date(preview.exportedAt).toLocaleString()}.
									Compatible export schema {preview.exportSchemaVersion}.
								</p>
								{unknownCount > 0 ? (
									<p className="mt-1 text-warning-foreground">
										{unknownCount} unknown region{" "}
										{unknownCount === 1 ? "ID was" : "IDs were"} ignored safely.
									</p>
								) : null}
							</div>
						</div>
					) : null}
					<DialogFooter>
						<Button
							variant="destructive"
							onClick={() => {
								if (!preview) return;
								replaceData(preview.state, "Imported progress applied.");
								setPreview(undefined);
							}}
						>
							{importCopy.confirm}
						</Button>
						<Button
							ref={cancelImportRef}
							variant="outline"
							onClick={() => setPreview(undefined)}
						>
							Cancel
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
