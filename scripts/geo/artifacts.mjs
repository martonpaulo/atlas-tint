import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * The exact locations and exact byte encodings of every generated geographic artifact.
 *
 * The build writes these files and the check reads them back, so both import this module
 * rather than repeating a path or a `JSON.stringify` shape. That is what lets the check
 * compare a committed artifact with its canonical source byte for byte instead of comparing
 * two hand-written approximations of the same thing.
 */

export const presetIds = ["world", "brazil", "spain"];

export const repositoryRoot = resolve(import.meta.dirname, "../..");
export const publicMapDirectory = join(repositoryRoot, "apps/web/public/maps");
export const manifestDirectory = join(
	repositoryRoot,
	"apps/web/src/features/atlas/presets/data",
);

export const manifestPath = (id) =>
	join(manifestDirectory, `${id}.manifest.json`);
export const topologyPath = (id) => join(publicMapDirectory, `${id}.topo.json`);
export const metadataPath = join(publicMapDirectory, "metadata.json");
export const geometryVersionsPath = join(
	manifestDirectory,
	"geometry-versions.json",
);

const indented = (value) => `${JSON.stringify(value, null, "\t")}\n`;

export const serializeManifest = indented;
export const serializeMetadata = indented;
export const serializeGeometryVersions = indented;
export const serializeTopology = (topology) => `${JSON.stringify(topology)}\n`;

export function digest(contents) {
	return createHash("sha256").update(contents).digest("hex");
}

export async function digestFile(path) {
	return digest(await readFile(path));
}
