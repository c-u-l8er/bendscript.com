/**
 * Returns the shortest distance from point (px, py) to the line segment (x1, y1) -> (x2, y2).
 */
export function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const lenSq = dx * dx + dy * dy;

	// Degenerate segment (start === end)
	if (lenSq === 0) {
		return Math.hypot(px - x1, py - y1);
	}

	// Project point onto segment and clamp to [0, 1]
	const t = Math.max(
		0,
		Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq)
	);

	const closestX = x1 + t * dx;
	const closestY = y1 + t * dy;

	return Math.hypot(px - closestX, py - closestY);
}
