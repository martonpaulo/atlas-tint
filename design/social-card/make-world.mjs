// Draws the social card's world map from the app's own shipped geometry
// (apps/web/public/maps/world.topo.json), with the projection the app uses by
// default (Equal Earth) and five marked states.
//   node design/social-card/make-world.mjs   (needs ImageMagick)
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(join(process.cwd(), "apps/web/package.json"));
const { geoEqualEarth, geoPath } = require("d3-geo");
const { feature } = require("topojson-client");
const { presimplify, simplify, quantile } = require("topojson-simplify");
const here = dirname(fileURLToPath(import.meta.url));
const topo = JSON.parse(
	readFileSync(
		join(process.cwd(), "apps/web/public/maps/world.topo.json"),
		"utf8",
	),
);
// Simplified for a 760px drawing only: the app keeps its full geometry. Keeping the
// top 8% of vertices by weight is well below a pixel at this scale.
const light = simplify(presimplify(topo), quantile(presimplify(topo), 0.92));
const world = feature(light, light.objects.entities);
const width = 760;
const height = 400;
const projection = geoEqualEarth().fitSize([width, height], world);
// One decimal is sub-pixel at this size and keeps the file small.
const path = geoPath(projection).digits(1);
const marked = {
	"world-br": "#6aa56a",
	"world-ca": "#4fb0a5",
	"world-pt": "#3f7fc2",
	"world-jp": "#a39a45",
	"world-au": "#8b80d6",
};
const shapes = world.features
	.map(
		(f) =>
			`<path d="${path(f)}" fill="${marked[f.properties.id] ?? "#ddd5ca"}"/>`,
	)
	.join("");
// The SVG is an intermediate: it goes to the git-ignored artifacts folder and stays
// on this machine, and only its 2x raster (design/social-card/world.png) is committed.
const svgPath = join(process.cwd(), "artifacts/social-card/world.svg");
mkdirSync(dirname(svgPath), { recursive: true });
writeFileSync(
	svgPath,
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><g stroke="#fbf8f3" stroke-width=".6" stroke-linejoin="round">${shapes}</g></svg>\n`,
);
execFileSync("magick", [
	"-density",
	"192",
	"-background",
	"none",
	svgPath,
	"-strip",
	join(here, "world.png"),
]);
console.log("wrote", svgPath, "and", join(here, "world.png"));
