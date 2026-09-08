import type { BoardSize, Mark, ShipClass } from '../types';
import type { Board } from '../board';
import { FLEET } from '../fleet';

/**
 * What a shooter can legitimately see of the opposing board: the marks it has
 * placed, and nothing else. The AI takes this rather than a Board so it cannot
 * reach the defender's ship list even by accident.
 */
export interface TargetView {
	size: BoardSize;
	marks: readonly (Mark | null)[];
	/**
	 * Set under MOBILE FLEET. A miss older than STALE_AFTER turns is no longer
	 * evidence the cell is empty, because a hull could have sailed into it.
	 */
	turn?: number;
}

/** One ship moves one cell per turn, so a miss survives about this long. */
export const STALE_AFTER = 3;

export function isStaleMiss(mark: Mark, turn: number | undefined): boolean {
	if (turn === undefined || mark.kind !== 'miss' || mark.turn === undefined) return false;
	return turn - mark.turn > STALE_AFTER;
}

export function viewOf(board: Board, turn?: number): TargetView {
	return { size: board.size, marks: board.marks, ...(turn !== undefined ? { turn } : {}) };
}

/**
 * Classes known to be gone. A hit only carries `revealedClass` once the shot
 * that sank the ship landed, which is exactly what the defender announces.
 */
export function sunkClasses(view: TargetView): Set<ShipClass> {
	const sunk = new Set<ShipClass>();
	for (const mark of view.marks) {
		if (mark?.kind === 'hit' && mark.revealedClass) sunk.add(mark.revealedClass);
	}
	return sunk;
}

export function remainingClasses(view: TargetView): ShipClass[] {
	const sunk = sunkClasses(view);
	return FLEET.map((spec) => spec.class).filter((cls) => !sunk.has(cls));
}
