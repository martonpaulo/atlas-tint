export function calculatePercentage(selected: number, total: number) {
	if (total <= 0) return 0;
	return Math.min(100, Math.max(0, (selected / total) * 100));
}

export function formatPercentage(selected: number, total: number) {
	const percentage = calculatePercentage(selected, total);
	if (percentage === 0 || percentage === 100)
		return `${percentage.toFixed(0)}%`;
	return `${percentage.toFixed(1)}%`;
}
