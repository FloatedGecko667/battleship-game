import type { Coord } from '../types';
import type { Board } from '../board';
import type { Rng } from '../rng';
import { viewOf, type TargetView } from './view';
import { huntTarget } from './hunt';
import { densestShot } from './density';

/** Matches the unit's Level 1 / 2 / 3 difficulty switch. */
export type Difficulty = 1 | 2 | 3;

export const DIFFICULTY_NAME: Record<Difficulty, string> = {
	1: 'ENSIGN',
	2: 'CAPTAIN',
	3: 'ADMIRAL'
};

/** A cell is worth firing at unless a shot has already resolved there. */
export function isUntried(view: TargetView, coord: Coord): boolean {
	const mark = view.marks[coord.row * view.size.cols + coord.col];
	return mark === null || mark === undefined || mark.kind === 'scan';
}

export function untriedCells(view: TargetView): Coord[] {
	const out: Coord[] = [];
	for (let i = 0; i < view.marks.length; i++) {
		const coord = { row: Math.floor(i / view.size.cols), col: i % view.size.cols };
		if (isUntried(view, coord)) out.push(coord);
	}
	return out;
}

/**
 * Hits that have not yet been attributed to a sunk ship. `revealedClass` is set
 * only when a ship goes down, so anything without it is still being hunted.
 */
export function liveHits(view: TargetView): Coord[] {
	const out: Coord[] = [];
	for (let i = 0; i < view.marks.length; i++) {
		const mark = view.marks[i];
		if (mark?.kind === 'hit' && !mark.revealedClass) {
			out.push({ row: Math.floor(i / view.size.cols), col: i % view.size.cols });
		}
	}
	return out;
}

export function pickRandom(view: TargetView, rng: Rng): Coord | null {
	const cells = untriedCells(view);
	return cells.length ? cells[rng.int(cells.length)] : null;
}

/**
 * Picks the CPU's shot. Takes a Board for convenience but immediately narrows
 * it to what a shooter may see, so no level can read the defender's fleet.
 */
export function chooseShot(board: Board, difficulty: Difficulty, rng: Rng): Coord | null {
	const view = viewOf(board);
	switch (difficulty) {
		case 1:
			return pickRandom(view, rng);
		case 2:
			return huntTarget(view, rng);
		case 3:
			return densestShot(view, rng) ?? pickRandom(view, rng);
	}
}

export { viewOf, type TargetView } from './view';
