import { Button } from "@atlas-tint/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@atlas-tint/ui/components/dropdown-menu";
import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

import { useTheme } from "@/components/theme-provider";
import { themePreferenceSchema } from "@/features/atlas/domain";
import { useAtlasStore } from "@/features/atlas/store";

export function ModeToggle() {
	const { setTheme } = useTheme();
	const themePreference = useAtlasStore(({ data }) => data.themePreference);
	const setThemePreference = useAtlasStore(
		({ setThemePreference: updateTheme }) => updateTheme,
	);

	useEffect(() => setTheme(themePreference), [setTheme, themePreference]);

	const chooseTheme = (value: string) => {
		const parsed = themePreferenceSchema.safeParse(value);
		if (!parsed.success) return;
		setThemePreference(parsed.data);
		setTheme(parsed.data);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="outline" size="icon" />}>
				<Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
				<Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
				<span className="sr-only">Toggle theme</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{themePreferenceSchema.options.map((value) => (
					<DropdownMenuItem
						key={value}
						onClick={() => chooseTheme(value)}
						aria-current={themePreference === value ? "true" : undefined}
					>
						{value[0]?.toUpperCase()}
						{value.slice(1)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
