import { describe, expect, it } from 'vitest';
import { boardSize } from '../edition';
import { createBoard } from '../board';
import { fireAt } from '../resolve';
import { mulberry32 } from '../rng';
import { randomFleet } from '../placement';
import { isUntried, liveHits, pickRandom, untriedCells } from './index';
import { huntTarget } from './hunt';
import type { Ship } from '../types';

const SIZE = boardSize('CLASSIC');

function boardWith(ships: Ship[]) {
	return createBoard(SIZE, ships);
}

describe('untried cells', () => {
	it('starts with the whole board and shrinks as shots land', () => {
		const board = boardWith([]);
		expect(untriedCells(board)).toHaveLength(SIZE.rows * SIZE.cols);

		fireAt(board, { row: 0, col: 0 });
		expect(untriedCells(board)).toHaveLength(SIZE.rows * SIZE.cols - 1);
		expect(isUntried(board, { row: 0, col: 0 })).toBe(false);
	});
});

describe('liveHits', () => {
	it('drops the cells of a ship once it is sunk', () => {
		const board = boardWith([{ class: 'PB', bow: { row: 0, col: 0 }, facing: 'W' }]);
		fireAt(board, { row: 0, col: 0 });
		expect(liveHits(board)).toHaveLength(1);

		fireAt(board, { row: 0, col: 1 });
		expect(liveHits(board)).toHaveLength(0);
	});
});

describe('huntTarget', () => {
	const rng = () => mulberry32(1);

	it('hunts on a parity lattice while nothing is wounded', () => {
		const board = boardWith([]);
		for (let i = 0; i < 30; i++) {
			const shot = huntTarget(board, rng())!;
			expect((shot.row + shot.col) % 2).toBe(0);
			fireAt(board, shot);
		}
	});

	it('goes for a neighbour of an unresolved hit', () => {
		const board = boardWith([{ class: 'DD', bow: { row: 4, col: 4 }, facing: 'W' }]);
		fireAt(board, { row: 4, col: 4 });

		const shot = huntTarget(board, rng())!;
		expect(Math.abs(shot.row - 4) + Math.abs(shot.col - 4)).toBe(1);
	});

	it('extends along the axis once two hits line up', () => {
		const board = boardWith([{ class: 'CV', bow: { row: 4, col: 2 }, facing: 'W' }]);
		fireAt(board, { row: 4, col: 3 });
		fireAt(board, { row: 4, col: 4 });

		const shot = huntTarget(board, rng())!;
		expect(shot.row).toBe(4);
		expect([2, 5]).toContain(shot.col);
	});

	it('never repeats a cell and always finishes the fleet', () => {
		const fleet = randomFleet(SIZE, mulberry32(9));
		const board = createBoard(SIZE, fleet);
		const seen = new Set<string>();
		const rngInstance = mulberry32(3);

		for (let turn = 0; turn < SIZE.rows * SIZE.cols; turn++) {
			const shot = huntTarget(board, rngInstance);
			if (!shot) break;
			const key = `${shot.row},${shot.col}`;
			expect(seen.has(key)).toBe(false);
			seen.add(key);
			fireAt(board, shot);
			if (board.ships.every((s) => s.hits.every(Boolean))) break;
		}
		expect(board.ships.every((s) => s.hits.every(Boolean))).toBe(true);
	});
});

describe('pickRandom', () => {
	it('returns null once the board is exhausted', () => {
		const board = boardWith([]);
		for (const cell of untriedCells(board)) fireAt(board, cell);
		expect(pickRandom(board, mulberry32(0))).toBeNull();
	});
});
