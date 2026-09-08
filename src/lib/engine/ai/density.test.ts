import { describe, expect, it } from 'vitest';
import { boardSize } from '../edition';
import { createBoard } from '../board';
import { fireAt, markScan } from '../resolve';
import { mulberry32 } from '../rng';
import { randomFleet } from '../placement';
import { cellsOf } from '../geometry';
import { densestShot, densityMap, liveHitsIn } from './density';
import { remainingClasses, sunkClasses, viewOf } from './view';
import type { Ship } from '../types';

const SIZE = boardSize('CLASSIC');
const at = (map: number[], row: number, col: number) => map[row * SIZE.cols + col];

describe('what the shooter can see', () => {
	it('learns a class only when the ship goes down', () => {
		const board = createBoard(SIZE, [{ class: 'PB', bow: { row: 0, col: 0 }, facing: 'W' }]);

		fireAt(board, { row: 0, col: 0 });
		expect(sunkClasses(viewOf(board)).size).toBe(0);
		expect(remainingClasses(viewOf(board))).toHaveLength(5);

		fireAt(board, { row: 0, col: 1 });
		expect([...sunkClasses(viewOf(board))]).toEqual(['PB']);
		expect(remainingClasses(viewOf(board))).not.toContain('PB');
	});
});

describe('densityMap', () => {
	it('favours the middle of an untouched board over the corners', () => {
		const map = densityMap(viewOf(createBoard(SIZE, [])));
		expect(at(map, 4, 4)).toBeGreaterThan(at(map, 0, 0));
	});

	it('is symmetric on an untouched board', () => {
		const map = densityMap(viewOf(createBoard(SIZE, [])));
		expect(at(map, 0, 0)).toBe(at(map, 9, 9));
		expect(at(map, 0, 3)).toBe(at(map, 9, 6));
	});

	it('zeroes every cell a shot has already resolved', () => {
		const board = createBoard(SIZE, []);
		fireAt(board, { row: 3, col: 3 });
		expect(at(densityMap(viewOf(board)), 3, 3)).toBe(0);
	});

	it('leaves a sonar-marked cell available', () => {
		const board = createBoard(SIZE, []);
		markScan(board, { row: 3, col: 3 });
		expect(at(densityMap(viewOf(board)), 3, 3)).toBeGreaterThan(0);
	});

	it('collapses onto the neighbours of a wounded ship', () => {
		const board = createBoard(SIZE, [{ class: 'CV', bow: { row: 4, col: 2 }, facing: 'W' }]);
		fireAt(board, { row: 4, col: 4 });

		const map = densityMap(viewOf(board));
		expect(liveHitsIn(viewOf(board))).toHaveLength(1);
		// Cells beside the hit must beat one far away.
		expect(at(map, 4, 5)).toBeGreaterThan(at(map, 9, 9));
		expect(at(map, 4, 3)).toBeGreaterThan(at(map, 0, 0));
	});

	it('stops counting a class once it has been sunk', () => {
		const board = createBoard(SIZE, [{ class: 'PB', bow: { row: 0, col: 0 }, facing: 'W' }]);
		const before = densityMap(viewOf(board));

		fireAt(board, { row: 0, col: 0 });
		fireAt(board, { row: 0, col: 1 });
		const after = densityMap(viewOf(board));

		// PB no longer contributes anywhere.
		expect(at(after, 5, 5)).toBeLessThan(at(before, 5, 5));
	});

	it('will not place a hull across a known miss', () => {
		const board = createBoard(SIZE, []);
		// Wall off column 5 so nothing can straddle it.
		for (let row = 0; row < SIZE.rows; row++) fireAt(board, { row, col: 5 });
		const map = densityMap(viewOf(board));
		expect(at(map, 4, 5)).toBe(0);
	});
});

describe('densestShot', () => {
	it('returns null once nothing is left to try', () => {
		const board = createBoard(SIZE, []);
		for (let row = 0; row < SIZE.rows; row++) {
			for (let col = 0; col < SIZE.cols; col++) fireAt(board, { row, col });
		}
		expect(densestShot(viewOf(board), mulberry32(1))).toBeNull();
	});

	it('never repeats a cell and finishes the fleet', () => {
		const board = createBoard(SIZE, randomFleet(SIZE, mulberry32(11)));
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

		const shot = densestShot(viewOf(board), mulberry32(2))!;
		expect(Math.abs(shot.row - 4) + Math.abs(shot.col - 4)).toBeLessThanOrEqual(2);
	});

	it('works on the wider DELUXE board', () => {
		const deluxe = boardSize('DELUXE');
		const board = createBoard(deluxe, randomFleet(deluxe, mulberry32(4)));
		const rng = mulberry32(6);

		for (let turn = 0; turn < deluxe.rows * deluxe.cols; turn++) {
			const shot = densestShot({ size: deluxe, marks: board.marks }, rng);
			if (!shot) break;
			fireAt(board, shot);
			if (board.ships.every((s) => s.hits.every(Boolean))) break;
		}
		expect(board.ships.every((s) => s.hits.every(Boolean))).toBe(true);
	});
});

describe('information discipline', () => {
	it('needs nothing but the marks to choose a shot', () => {
		const board = createBoard(SIZE, randomFleet(SIZE, mulberry32(21)));
		fireAt(board, cellsOf(board.ships[0])[0]);

		// A view carries no ship list at all, so a cheating AI could not compile.
		const view = { size: board.size, marks: board.marks };
		expect(densestShot(view, mulberry32(1))).not.toBeNull();
	});
});
