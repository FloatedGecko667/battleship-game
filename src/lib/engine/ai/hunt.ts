import type { Coord } from '../types';
import { inBounds } from '../geometry';
import type { Board } from '../board';
import type { Rng } from '../rng';
import { isUntried, liveHits, pickRandom, untriedCells } from './index';

const ORTHOGONAL: Coord[] = [
	{ row: -1, col: 0 },
	{ row: 1, col: 0 },
	{ row: 0, col: -1 },
	{ row: 0, col: 1 }
];

/**
 * Hunt/Target. With no unresolved hits it sweeps on a parity lattice - the
 * smallest ship is two cells long, so every other cell still cannot be missed.
 * Once it has a hit it works outwards, and once it has two collinear hits it
 * commits to that axis and pushes at both ends.
 */
export function huntTarget(board: Board, rng: Rng): Coord | null {
	const hits = liveHits(board);
	if (hits.length === 0) return parityHunt(board, rng);

	const axial = extendAlongAxis(board, hits);
	if (axial) return axial;

	const neighbours = hits
		.flatMap((hit) => ORTHOGONAL.map((d) => ({ row: hit.row + d.row, col: hit.col + d.col })))
		.filter((c) => inBounds(c, board.size) && isUntried(board, c));

	return neighbours.length ? neighbours[rng.int(neighbours.length)] : parityHunt(board, rng);
}

/** Two hits in a line pin the ship's axis; keep pushing off either end. */
function extendAlongAxis(board: Board, hits: Coord[]): Coord | null {
	for (const a of hits) {
		for (const b of hits) {
			if (a === b) continue;

			if (a.row === b.row && Math.abs(a.col - b.col) === 1) {
				const cols = hits.filter((h) => h.row === a.row).map((h) => h.col);
				const ends = [
					{ row: a.row, col: Math.min(...cols) - 1 },
					{ row: a.row, col: Math.max(...cols) + 1 }
				];
				const open = ends.filter((c) => inBounds(c, board.size) && isUntried(board, c));
				if (open.length) return open[0];
			}

			if (a.col === b.col && Math.abs(a.row - b.row) === 1) {
				const rows = hits.filter((h) => h.col === a.col).map((h) => h.row);
				const ends = [
					{ row: Math.min(...rows) - 1, col: a.col },
					{ row: Math.max(...rows) + 1, col: a.col }
				];
				const open = ends.filter((c) => inBounds(c, board.size) && isUntried(board, c));
				if (open.length) return open[0];
			}
		}
	}
	return null;
}

function parityHunt(board: Board, rng: Rng): Coord | null {
	const lattice = untriedCells(board).filter((c) => (c.row + c.col) % 2 === 0);
	if (lattice.length) return lattice[rng.int(lattice.length)];
	return pickRandom(board, rng);
}
