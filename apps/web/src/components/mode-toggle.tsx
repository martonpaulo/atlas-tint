import { Button } from "@atlas-tint/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@atlas-tint/ui/components/dropdown-menu";
import { Moon, Sun } from "lucide-react";

import { themePreferenceSchema } from "@/features/atlas/domain";
import { useAtlasStore } from "@/features/atlas/store";

const appearanceLabels = {
	light: "Light",
	dark: "Dark",
	system: "System",
} as const;

export function ModeToggle() {
	const themePreference = useAtlasStore(({ data }) => data.themePreference);
	const setThemePreference = useAtlasStore(
		({ setThemePreference: updateTheme }) => updateTheme,
	);

	const chooseTheme = (value: string) => {
		const parsed = themePreferenceSchema.safeParse(value);
		// The store is the only durable authority; the document follows it, never the reverse.
		if (parsed.success) setThemePreference(parsed.data);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="outline" size="icon" />}>
				<Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
				<Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
				{/* Stateful, because "Toggle theme" said nothing about which of three is chosen. */}
				<span className="sr-only">
					Appearance: {appearanceLabels[themePreference]}
				</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuRadioGroup
					value={themePreference}
					onValueChange={chooseTheme}
				>
					{themePreferenceSchema.options.map((value) => (
						// Appearance is chosen once, so the menu closes rather than staying open
						// for further adjustment the way a filter radio group would.
						<DropdownMenuRadioItem key={value} value={value} closeOnClick>
							{appearanceLabels[value]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
