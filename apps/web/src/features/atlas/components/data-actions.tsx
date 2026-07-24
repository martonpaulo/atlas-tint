import { Button } from "@atlas-tint/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@atlas-tint/ui/components/dialog";
import { Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useState } from "react";

import type { PresetId } from "@/features/atlas/domain";
import {
	type ImportPreview,
	serializeAtlasExport,
	validateImportText,
} from "@/features/atlas/import-export";
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
		try {
			const [text, manifests] = await Promise.all([
				file.text(),
				loadAllManifests(),
			]);
			const result = validateImportText(text, manifests);
			if (!result.ok) {
				setImportMessage(result.message);
				setPreview(undefined);
				return;
			}
			setImportMessage(undefined);
			setPreview(result.preview);
		} catch (error) {
			setImportMessage(
				error instanceof Error
					? error.message
					: "The import could not be read.",
			);
		}
	};

	const confirmReset = () => {
		if (resetScope === "preset") resetPreset(presetId);
		if (resetScope === "all") resetAll();
		setResetScope(undefined);
	};

	const unknownCount = preview
		? Object.values(preview.unknownIds).reduce(
				(total, ids) => total + ids.length,
				0,
			)
		: 0;

	return (
		<section
			aria-labelledby="data-actions-title"
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
				<label className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 font-medium text-xs transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted">
					<Upload className="size-4" aria-hidden="true" /> Import
					<input
						type="file"
						accept="application/json,.json"
						className="sr-only"
						aria-label="Import progress JSON"
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
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{resetScope === "all"
								? "Reset all local progress?"
								: `Reset ${presetName}?`}
						</DialogTitle>
						<DialogDescription>
							{resetScope === "all"
								? "This removes selections, custom colors, and preferences for every preset in this browser. Export first if you may want them later."
								: `This removes selections and custom colors for ${presetName}. Other presets remain unchanged.`}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="destructive" onClick={confirmReset}>
							{resetScope === "all" ? "Reset everything" : "Reset preset"}
						</Button>
						<Button variant="outline" onClick={() => setResetScope(undefined)}>
							Cancel
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={preview !== undefined}
				onOpenChange={(open) => !open && setPreview(undefined)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Review imported progress</DialogTitle>
						<DialogDescription>
							This will atomically replace progress for all presets. Geometry is
							never included in an export.
						</DialogDescription>
					</DialogHeader>
					{preview ? (
						<div className="mt-5 grid gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm">
							{preview.presets.map((preset) => (
								<p key={preset.id} className="flex justify-between">
									<span>{preset.name}</span>
									<strong>
										{preset.selectedCount} / {preset.total}
									</strong>
								</p>
							))}
							<p className="border-border border-t pt-3 text-muted-foreground text-xs">
								Exported {new Date(preview.exportedAt).toLocaleString()} with
								AtlasTint {preview.applicationVersion}.
							</p>
							{unknownCount > 0 ? (
								<p className="text-warning-foreground text-xs">
									{unknownCount} unknown region{" "}
									{unknownCount === 1 ? "ID was" : "IDs were"} ignored safely.
								</p>
							) : null}
						</div>
					) : null}
					<DialogFooter>
						<Button
							onClick={() => {
								if (!preview) return;
								replaceData(preview.state, "Imported progress applied.");
								setPreview(undefined);
							}}
						>
							Replace progress
						</Button>
						<Button variant="outline" onClick={() => setPreview(undefined)}>
							Cancel
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
