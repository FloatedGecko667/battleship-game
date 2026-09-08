import type { Coord, Facing } from '../types';
import { cellsOf } from '../geometry';
import { shipLength } from '../fleet';
import type { Rng } from '../rng';
import { remainingClasses, type TargetView } from './view';

/** How much more a placement counts for each unresolved hit it explains. */
const HIT_WEIGHT = 8;

function index(view: TargetView, row: number, col: number): number {
	return row * view.size.cols + col;
}

/** A cell can still hide hull unless a shot has ruled it out. */
function couldHideHull(view: TargetView, coord: Coord): boolean {
	if (
		coord.row < 0 ||
		coord.row >= view.size.rows ||
		coord.col < 0 ||
		coord.col >= view.size.cols
	) {
		return false;
	}
	const mark = view.marks[index(view, coord.row, coord.col)];
	if (!mark) return true;
	// A sonar sweep says nothing about the individual cell it is centred on.
	if (mark.kind === 'scan') return true;
	// Water, or a cell already accounted for by a ship that has gone down.
	if (mark.kind === 'miss') return false;
	return !mark.revealedClass;
}

/** Hits not yet attributed to a sunk ship: something is still wounded there. */
export function liveHitsIn(view: TargetView): Coord[] {
	const out: Coord[] = [];
	for (let i = 0; i < view.marks.length; i++) {
		const mark = view.marks[i];
		if (mark?.kind === 'hit' && !mark.revealedClass) {
			out.push({ row: Math.floor(i / view.size.cols), col: i % view.size.cols });
		}
	}
	return out;
}

/**
 * Counts, for every cell, how many legal placements of the surviving fleet
 * would cover it.
 *
 * With a wounded ship on the board only placements covering at least one
 * unresolved hit are counted, which collapses the map onto the live target.
 *
 * Enumeration is cheap enough to redo every turn: five classes over a 14x10
 * board is on the order of a thousand placements.
 */
export function densityMap(view: TargetView): number[] {
	const { rows, cols } = view.size;
	const map = new Array<number>(rows * cols).fill(0);
	const wounded = liveHitsIn(view);
	const woundedKeys = new Set(wounded.map((c) => `${c.row},${c.col}`));

	for (const cls of remainingClasses(view)) {
		const length = shipLength(cls);

		// 'N' runs downwards and 'W' runs rightwards, which covers both axes
		// without double counting a hull.
		for (const facing of ['N', 'W'] as Facing[]) {
			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const cells = cellsOf({ class: cls, bow: { row, col }, facing });
					if (!cells.every((cell) => couldHideHull(view, cell))) continue;

					// Weight by how many unresolved hits the placement explains. A hull
					// that accounts for two wounded cells has picked out the ship's
					// axis, and should dominate one that merely touches a single hit.
					let covered = 0;
					for (const cell of cells) {
						if (woundedKeys.has(`${cell.row},${cell.col}`)) covered++;
					}
					if (woundedKeys.size > 0 && covered === 0) continue;

					const weight = covered === 0 ? 1 : HIT_WEIGHT ** covered;
					for (const cell of cells) map[index(view, cell.row, cell.col)] += weight;
				}
			}
		}
	}

	// Never aim at a cell already resolved, however dense it looks.
	for (let i = 0; i < map.length; i++) {
		const mark = view.marks[i];
		if (mark && mark.kind !== 'scan') map[i] = 0;
	}

	return map;
}

/** The densest untried cell, ties broken at random. */
export function densestShot(view: TargetView, rng: Rng): Coord | null {
	return topDensity(view, 1, rng)[0] ?? null;
}

/**
 * The `count` densest untried cells, from a single map.
 *
 * Salvo answers a whole volley at once, so the shooter learns nothing between
 * its shots. Evaluating one map and taking the top slice models that exactly -
 * re-running the search after each pick would leak feedback that does not exist.
 */
export function topDensity(view: TargetView, count: number, rng: Rng): Coord[] {
	const map = densityMap(view);
	const candidates: number[] = [];
	for (let i = 0; i < map.length; i++) {
		if (map[i] > 0) candidates.push(i);
	}
	if (!candidates.length) return [];

	// Shuffle first so equal densities are not always broken the same way.
	rng.shuffle(candidates);
	candidates.sort((a, b) => map[b] - map[a]);

	return candidates.slice(0, count).map((i) => ({
		row: Math.floor(i / view.size.cols),
		col: i % view.size.cols
	}));
}
