import { Button } from "@atlas-tint/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@atlas-tint/ui/components/dialog";
import { useState } from "react";

import type { PersistenceMode } from "@/features/atlas/persistence-adapter";
import { useAtlasStore } from "@/features/atlas/store";

/** What the header may truthfully claim about durability in each mode. */
const persistenceLabels: Record<PersistenceMode, string> = {
	durable: "Saved locally",
	"session-only": "This session only",
	"save-failed": "Not saved",
	"future-blocked": "Saved data locked",
};

export function persistenceStatusLabel(mode: PersistenceMode) {
	return persistenceLabels[mode];
}

function downloadIncompatibleRecord(record: string) {
	const url = URL.createObjectURL(
		new Blob([record], { type: "application/json" }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = `atlas-tint-saved-record-${new Date().toISOString().slice(0, 10)}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

export function PersistenceNotice() {
	const persistenceMode = useAtlasStore(({ persistenceMode: mode }) => mode);
	const storageNotice = useAtlasStore(({ storageNotice }) => storageNotice);
	const incompatibleRecord = useAtlasStore(
		({ incompatibleRecord }) => incompatibleRecord,
	);
	const replaceIncompatibleRecord = useAtlasStore(
		({ replaceIncompatibleRecord: replace }) => replace,
	);
	const [confirmingReplace, setConfirmingReplace] = useState(false);

	if (!storageNotice) return null;

	return (
		<div
			className="fixed right-4 bottom-4 z-40 max-w-sm rounded-md border border-warning/40 bg-warning-surface px-4 py-3 text-warning-foreground text-xs leading-5 shadow-warning"
			role="status"
		>
			{storageNotice}
			{persistenceMode === "future-blocked" ? (
				<div className="mt-3 flex flex-wrap gap-2">
					{incompatibleRecord ? (
						<Button
							variant="outline"
							onClick={() => downloadIncompatibleRecord(incompatibleRecord)}
						>
							Download saved file
						</Button>
					) : null}
					<Button
						variant="destructive"
						onClick={() => setConfirmingReplace(true)}
					>
						Replace it
					</Button>
				</div>
			) : null}

			<Dialog open={confirmingReplace} onOpenChange={setConfirmingReplace}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Replace the newer saved progress?</DialogTitle>
						<DialogDescription>
							The progress saved in this browser was written by a newer
							AtlasTint version. Replacing it permanently discards that record
							and saves this session over it instead. Download it first if you
							may want it back.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="destructive"
							onClick={() => {
								replaceIncompatibleRecord();
								setConfirmingReplace(false);
							}}
						>
							Replace saved progress
						</Button>
						<Button
							variant="outline"
							onClick={() => setConfirmingReplace(false)}
						>
							Cancel
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
