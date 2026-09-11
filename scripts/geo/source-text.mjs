export function cleanSourceText(value) {
	return String(value ?? "")
		.replaceAll("\0", "")
		.trim();
}
