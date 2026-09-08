import type { Facing, FleetShip, Ship } from '$lib/engine/types';
import { cellsOf } from '$lib/engine/geometry';

/** Glyph for the bow cell, pointing the way the ship faces. */
export const BOW_GLYPH: Record<Facing, string> = {
	N: '▲',
	E: '▶',
	S: '▼',
	W: '◀'
};

/** Every non-bow hull cell is drawn as a solid block. */
export const HULL_GLYPH = '▓';

export interface CodeOverlay {
	/** Zero-based grid placement. */
	row: number;
	col: number;
	rowSpan: number;
	colSpan: number;
	text: string;
}

/**
 * White hull-code labels drawn on top of the fill.
 *
 * Every class puts its code on each cell behind the bow - except PB, which is
 * only two cells long and so would have just one label cell. That one gets a
 * single label spanning the whole hull, bow glyph included.
 */
export function codeOverlays(ship: Ship | FleetShip): CodeOverlay[] {
	const cells = cellsOf(ship);

	if (ship.class === 'PB') {
		const rows = cells.map((c) => c.row);
		const cols = cells.map((c) => c.col);
		return [
			{
				row: Math.min(...rows),
				col: Math.min(...cols),
				rowSpan: Math.max(...rows) - Math.min(...rows) + 1,
				colSpan: Math.max(...cols) - Math.min(...cols) + 1,
				text: ship.class
			}
		];
	}

	return cells.slice(1).map((cell) => ({
		row: cell.row,
		col: cell.col,
		rowSpan: 1,
		colSpan: 1,
		text: ship.class
	}));
}
