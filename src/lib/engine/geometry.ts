import type { BoardSize, Coord, Facing, Ship } from './types';
import { shipLength } from './fleet';

export const FACINGS: readonly Facing[] = ['N', 'E', 'S', 'W'];

/** Unit vector pointing from the bow towards the stern. */
const STERN_STEP: Record<Facing, Coord> = {
	N: { row: 1, col: 0 },
	E: { row: 0, col: -1 },
	S: { row: -1, col: 0 },
	W: { row: 0, col: 1 }
};

/** Rotates a facing one quarter turn clockwise. */
export function rotateCW(facing: Facing): Facing {
	return FACINGS[(FACINGS.indexOf(facing) + 1) % FACINGS.length];
}

/** Cells the ship occupies, bow first. */
export function cellsOf(ship: Ship): Coord[] {
	const step = STERN_STEP[ship.facing];
	const cells: Coord[] = [];
	for (let i = 0; i < shipLength(ship.class); i++) {
		cells.push({ row: ship.bow.row + step.row * i, col: ship.bow.col + step.col * i });
	}
	return cells;
}

export function inBounds(coord: Coord, size: BoardSize): boolean {
	return coord.row >= 0 && coord.row < size.rows && coord.col >= 0 && coord.col < size.cols;
}

export function sameCoord(a: Coord, b: Coord): boolean {
	return a.row === b.row && a.col === b.col;
}

export function coordKey(coord: Coord): string {
	return `${coord.row},${coord.col}`;
}

/**
 * Offsets tried when a rotation would leave the board or hit another ship:
 * slide along the hull axis by up to length-1 cells, nearest first.
 * Returns offsets in bow-relative terms for the *new* facing.
 */
export function kickOffsets(facing: Facing, length: number): Coord[] {
	const step = STERN_STEP[facing];
	// `|| 0` keeps -0 out of the offsets so they compare cleanly.
	const at = (n: number) => n || 0;
	const offsets: Coord[] = [{ row: 0, col: 0 }];
	for (let d = 1; d < length; d++) {
		offsets.push({ row: at(step.row * d), col: at(step.col * d) });
		offsets.push({ row: at(-step.row * d), col: at(-step.col * d) });
	}
	return offsets;
}
