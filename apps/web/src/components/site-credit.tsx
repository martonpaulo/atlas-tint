/**
 * The fleet credit (windowhop/docs footer): external links only, and the real licence from
 * LICENSE. The year is literal so the credit never depends on the reader's clock.
 */

const SOURCE_URL = "https://github.com/martonpaulo/atlastint";
const AUTHOR_URL = "https://martonpaulo.com/";

/** The fleet's mark for a link that leaves the site, copied from windowhop/docs. */
function ExternalIcon() {
	return (
		<svg
			className="external-icon"
			viewBox="0 0 12 12"
			width="12"
			height="12"
			fill="none"
			aria-hidden="true"
			focusable="false"
		>
			<path
				d="M3.6 8.4 8.4 3.6M4.8 3.6h3.6v3.6"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

const linkClass =
	"items-center font-medium text-foreground/80 underline-offset-2 hover:text-primary hover:underline";

function CreditLinks() {
	return (
		<>
			<a
				className={`${linkClass} inline-flex`}
				href={SOURCE_URL}
				rel="noopener"
			>
				Source
				<ExternalIcon />
			</a>
			<a className={linkClass} href={AUTHOR_URL} rel="noopener">
				martonpaulo.com
				<ExternalIcon />
			</a>
		</>
	);
}

/**
 * The map attribution and the credit as one line in the atlas corner, a step smaller than the
 * legend and in its tone. It never wraps, so it cannot take height from the map. The credit, never
 * the required data attribution, gives way when the legend leaves less room: a container query on
 * the space left picks the longest form that fits. The breakpoints are sized for the longest
 * attribution (Spain's), so every atlas fits.
 */
export function InlineCredit({ attribution }: { attribution: string }) {
	return (
		<div className="@container min-w-0 flex-1">
			<p className="flex items-center justify-end gap-1.5 whitespace-nowrap text-right text-[0.625rem]">
				<span>{attribution} ·</span>
				<span className="@min-[680px]:inline hidden">
					Developed by Marton Paulo · MIT licensed · © 2026 AtlasTint
					contributors. ·
				</span>
				<span className="@min-[310px]:inline @min-[680px]:hidden hidden">
					Marton Paulo ·
				</span>
				<span className="@min-[340px]:inline @min-[680px]:hidden hidden">
					MIT ·
				</span>
				<a
					className={`${linkClass} inline-flex`}
					href={SOURCE_URL}
					rel="noopener"
				>
					Source
					<ExternalIcon />
				</a>
				<span className="@min-[680px]:inline hidden">·</span>
				<a
					className={`${linkClass} @min-[680px]:inline-flex hidden`}
					href={AUTHOR_URL}
					rel="noopener"
				>
					martonpaulo.com
					<ExternalIcon />
				</a>
			</p>
		</div>
	);
}

/** The small-window screen's footer: centred at the foot, in its secondary text tone. */
export function ScreenCredit() {
	return (
		<footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-6 text-center text-muted-foreground text-xs">
			<p>
				Developed by Marton Paulo · MIT licensed · © 2026 AtlasTint
				contributors.
			</p>
			<nav aria-label="Project links" className="flex gap-4">
				<CreditLinks />
			</nav>
		</footer>
	);
}
