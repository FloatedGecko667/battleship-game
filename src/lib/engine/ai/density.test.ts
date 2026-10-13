import { describe, expect, it } from 'vitest';
import { boardSize } from '../edition';
import { createBoard, type Board } from '../board';
import { fireAt, markScan } from '../resolve';
import { mulberry32 } from '../rng';
import { randomFleet } from '../placement';
import { fleetClasses } from '../fleet';
import { cellsOf } from '../geometry';
import { densestShot, densityMap, liveHitsIn } from './density';
import { remainingClasses, sunkClasses, viewOf } from './view';
import type { Ship } from '../types';

const SIZE = boardSize('CLASSIC');

/**
 * Hand-built boards hold one or two ships, but a shooter always faces a whole
 * fleet, so give the view the one the density map should be reasoning about.
 */
const withFleet = (board: Board, turn?: number) => ({
	...viewOf(board, turn),
	fleet: fleetClasses('DELUXE')
});
const at = (map: number[], row: number, col: number) => map[row * SIZE.cols + col];

describe('what the shooter can see', () => {
	it('learns a class only when the ship goes down', () => {
		const board = createBoard(SIZE, [{ class: 'PB', bow: { row: 0, col: 0 }, facing: 'W' }]);

		fireAt(board, { row: 0, col: 0 });
		expect(sunkClasses(withFleet(board)).size).toBe(0);
		expect(remainingClasses(withFleet(board))).toHaveLength(5);

		fireAt(board, { row: 0, col: 1 });
		expect([...sunkClasses(withFleet(board))]).toEqual(['PB']);
		expect(remainingClasses(withFleet(board))).not.toContain('PB');
	});
});

describe('densityMap', () => {
	it('favours the middle of an untouched board over the corners', () => {
		const map = densityMap(withFleet(createBoard(SIZE, [])));
		expect(at(map, 4, 4)).toBeGreaterThan(at(map, 0, 0));
	});

	it('is symmetric on an untouched board', () => {
		const map = densityMap(withFleet(createBoard(SIZE, [])));
		expect(at(map, 0, 0)).toBe(at(map, 9, 9));
		expect(at(map, 0, 3)).toBe(at(map, 9, 6));
	});

	it('zeroes every cell a shot has already resolved', () => {
		const board = createBoard(SIZE, []);
		fireAt(board, { row: 3, col: 3 });
		expect(at(densityMap(withFleet(board)), 3, 3)).toBe(0);
	});

	it('leaves a sonar-marked cell available', () => {
		const board = createBoard(SIZE, []);
		markScan(board, { row: 3, col: 3 });
		expect(at(densityMap(withFleet(board)), 3, 3)).toBeGreaterThan(0);
	});

	it('collapses onto the neighbours of a wounded ship', () => {
		const board = createBoard(SIZE, [{ class: 'CV', bow: { row: 4, col: 2 }, facing: 'W' }]);
		fireAt(board, { row: 4, col: 4 });

		const map = densityMap(withFleet(board));
		expect(liveHitsIn(withFleet(board))).toHaveLength(1);
		// Cells beside the hit must beat one far away.
		expect(at(map, 4, 5)).toBeGreaterThan(at(map, 9, 9));
		expect(at(map, 4, 3)).toBeGreaterThan(at(map, 0, 0));
	});

	it('stops counting a class once it has been sunk', () => {
		const board = createBoard(SIZE, [{ class: 'PB', bow: { row: 0, col: 0 }, facing: 'W' }]);
		const before = densityMap(withFleet(board));

		fireAt(board, { row: 0, col: 0 });
		fireAt(board, { row: 0, col: 1 });
		const after = densityMap(withFleet(board));

		// PB no longer contributes anywhere.
		expect(at(after, 5, 5)).toBeLessThan(at(before, 5, 5));
	});

	it('will not place a hull across a known miss', () => {
		const board = createBoard(SIZE, []);
		// Wall off column 5 so nothing can straddle it.
		for (let row = 0; row < SIZE.rows; row++) fireAt(board, { row, col: 5 });
		const map = densityMap(withFleet(board));
		expect(at(map, 4, 5)).toBe(0);
	});
});

describe('densestShot', () => {
	it('returns null once nothing is left to try', () => {
		const board = createBoard(SIZE, []);
		for (let row = 0; row < SIZE.rows; row++) {
			for (let col = 0; col < SIZE.cols; col++) fireAt(board, { row, col });
		}
		expect(densestShot(withFleet(board), mulberry32(1))).toBeNull();
	});

	it('never repeats a cell and finishes the fleet', () => {
		const board = createBoard(SIZE, randomFleet(SIZE, mulberry32(11), fleetClasses('CLASSIC')));
		const rng = mulberry32(5);
		const seen = new Set<string>();

		for (let turn = 0; turn < SIZE.rows * SIZE.cols; turn++) {
			const shot = densestShot(viewOf(board), rng);
			if (!shot) break;
			const key = `${shot.row},${shot.col}`;
			expect(seen.has(key)).toBe(false);
			seen.add(key);
			fireAt(board, shot);
			if (board.ships.every((s) => s.hits.every(Boolean))) break;
		}
		expect(board.ships.every((s) => s.hits.every(Boolean))).toBe(true);
	});

	it('goes straight for a wounded ship rather than hunting elsewhere', () => {
		const board = createBoard(SIZE, [{ class: 'CV', bow: { row: 4, col: 2 }, facing: 'W' }]);
		fireAt(board, { row: 4, col: 4 });

		const shot = densestShot(withFleet(board), mulberry32(2))!;
		expect(Math.abs(shot.row - 4) + Math.abs(shot.col - 4)).toBeLessThanOrEqual(2);
	});

	it('works on the wider DELUXE board', () => {
		const deluxe = boardSize('DELUXE');
		const board = createBoard(deluxe, randomFleet(deluxe, mulberry32(4), fleetClasses('DELUXE')));
		const rng = mulberry32(6);

		for (let turn = 0; turn < deluxe.rows * deluxe.cols; turn++) {
			const shot = densestShot(viewOf(board), rng);
			if (!shot) break;
			fireAt(board, shot);
			if (board.ships.every((s) => s.hits.every(Boolean))) break;
		}
		expect(board.ships.every((s) => s.hits.every(Boolean))).toBe(true);
	});
});

describe('information discipline', () => {
	it('needs nothing but the marks to choose a shot', () => {
		const board = createBoard(SIZE, randomFleet(SIZE, mulberry32(21), fleetClasses('CLASSIC')));
		fireAt(board, cellsOf(board.ships[0])[0]);

		// A view carries no ship list at all, so a cheating AI could not compile.
		const view = viewOf(board);
		expect(densestShot(view, mulberry32(1))).not.toBeNull();
	});
});
