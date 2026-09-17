import { Button } from "@atlastint/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@atlastint/ui/components/dialog";
import { Info } from "lucide-react";
import { useRef } from "react";

/**
 * Who made AtlasTint, under which licence, and whose data and typefaces it stands on.
 *
 * The facts are the recorded ones: author and licence from AGENTS.md and LICENSE, data and
 * typeface credits from NOTICE.md. No biography and no release version (#42): the product deploys
 * continuously and shows no version.
 */

export const REPOSITORY_URL = "https://github.com/martonpaulo/atlastint";

interface Credit {
	name: string;
	href: string;
	detail: string;
}

export const dataCredits: readonly Credit[] = [
	{
		name: "Natural Earth",
		href: "https://www.naturalearthdata.com/",
		detail: "World sovereign states: Admin 0 Countries 5.1.1, public domain.",
	},
	{
		name: "IBGE",
		href: "https://www.ibge.gov.br/",
		detail:
			"Brazilian federative units: Malha Municipal Digital 2024, official territorial mesh.",
	},
	{
		name: "IGN/CNIG",
		href: "https://www.ign.es/",
		detail:
			"Spanish provinces and autonomous cities: derived from BDLJE, CC BY 4.0, ign.es.",
	},
];

export const typefaceCredits: readonly Credit[] = [
	{
		name: "Source Serif 4",
		href: "https://github.com/adobe-fonts/source-serif",
		detail: "Titles, SIL Open Font License 1.1.",
	},
	{
		name: "Figtree",
		href: "https://github.com/erikdkennedy/figtree",
		detail: "Interface, SIL Open Font License 1.1.",
	},
	{
		name: "Gabarito",
		href: "https://github.com/naipefoundry/gabarito",
		detail: "Display headings, SIL Open Font License 1.1.",
	},
];

const linkClass =
	"font-medium text-foreground underline decoration-border underline-offset-2 hover:text-primary hover:decoration-primary";

function CreditList({
	title,
	credits,
}: {
	title: string;
	credits: readonly Credit[];
}) {
	return (
		<section aria-label={title}>
			<h3 className="text-eyebrow text-muted-foreground">{title}</h3>
			<ul className="mt-2 grid gap-1.5 text-sm leading-6">
				{credits.map((credit) => (
					<li key={credit.name}>
						<a className={linkClass} href={credit.href} rel="noopener">
							{credit.name}
						</a>{" "}
						<span className="text-muted-foreground">{credit.detail}</span>
					</li>
				))}
			</ul>
		</section>
	);
}

export function AboutDialog() {
	// The first tabbable element is a link that leaves the site; start on the harmless Done instead.
	const doneRef = useRef<HTMLButtonElement>(null);
	return (
		<Dialog>
			<DialogTrigger
				render={<Button variant="ghost" className="justify-start" />}
			>
				<Info data-icon="inline-start" /> About AtlasTint
			</DialogTrigger>
			<DialogContent initialFocus={doneRef}>
				<DialogHeader>
					<DialogTitle>About AtlasTint</DialogTitle>
					<DialogDescription>
						A local-first interactive atlas for selecting, coloring, and
						tracking the regions of the world, Brazil, and Spain.
					</DialogDescription>
				</DialogHeader>

				<div className="mt-5 grid gap-5">
					<section aria-label="Project">
						<h3 className="text-eyebrow text-muted-foreground">Project</h3>
						<p className="mt-2 text-sm leading-6">
							Developed by Marton Paulo. Open source under the MIT License.
						</p>
						<p className="mt-1 text-sm leading-6">
							<a className={linkClass} href={REPOSITORY_URL} rel="noopener">
								github.com/martonpaulo/atlastint
							</a>
						</p>
					</section>

					<section aria-label="Your data">
						<h3 className="text-eyebrow text-muted-foreground">Your data</h3>
						<p className="mt-2 text-sm leading-6">
							Progress is saved only in this browser&apos;s local storage and is
							never sent anywhere. Export a JSON file to keep a copy or move it
							to another browser.
						</p>
					</section>

					<CreditList title="Map data" credits={dataCredits} />
					<CreditList title="Typefaces" credits={typefaceCredits} />
				</div>

				<DialogFooter>
					<DialogClose ref={doneRef} render={<Button variant="outline" />}>
						Done
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
