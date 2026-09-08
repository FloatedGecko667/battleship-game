import type { Coord } from '../types';
import { cellIndex, indexToCoord, type Board } from '../board';
import type { Rng } from '../rng';

/** Matches the unit's Level 1 / 2 / 3 difficulty switch. */
export type Difficulty = 1 | 2 | 3;

export const DIFFICULTY_NAME: Record<Difficulty, string> = {
	1: 'ENSIGN',
	2: 'CAPTAIN',
	3: 'ADMIRAL'
};

/** A cell is worth firing at unless a shot has already resolved there. */
export function isUntried(board: Board, coord: Coord): boolean {
	const mark = board.marks[cellIndex(coord, board.size)];
	return mark === null || mark.kind === 'scan';
}

export function untriedCells(board: Board): Coord[] {
	const out: Coord[] = [];
	for (let i = 0; i < board.marks.length; i++) {
		const coord = indexToCoord(i, board.size);
		if (isUntried(board, coord)) out.push(coord);
	}
	return out;
}

/**
 * Hits that have not yet been attributed to a sunk ship. `revealedClass` is set
 * only when a ship goes down, so anything without it is still being hunted.
 */
export function liveHits(board: Board): Coord[] {
	const out: Coord[] = [];
	for (let i = 0; i < board.marks.length; i++) {
		const mark = board.marks[i];
		if (mark?.kind === 'hit' && !mark.revealedClass) out.push(indexToCoord(i, board.size));
	}
	return out;
}

export function pickRandom(board: Board, rng: Rng): Coord | null {
	const cells = untriedCells(board);
	return cells.length ? cells[rng.int(cells.length)] : null;
}
