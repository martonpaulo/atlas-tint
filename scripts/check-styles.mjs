import { readdir, readFile } from "node:fs/promises";

const assetDirectory = new URL("../apps/web/dist/assets/", import.meta.url);
const cssFiles = (await readdir(assetDirectory)).filter((name) =>
	name.endsWith(".css"),
);
if (cssFiles.length === 0)
	throw new Error("No compiled stylesheet was produced.");

for (const name of cssFiles) {
	const css = await readFile(new URL(name, assetDirectory), "utf8");
	// Direct self-reference is cyclic even when another selector currently masks the defect.
	const selfReference = /(--[\w-]+)\s*:\s*var\(\s*\1\s*[,)]/g;
	for (const match of css.matchAll(selfReference)) {
		throw new Error(`Cyclic custom property ${match[1]} in ${name}.`);
	}
}
console.log("Compiled styles contain no self-referencing custom properties.");
