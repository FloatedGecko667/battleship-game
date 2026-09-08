import { describe, expect, it } from 'vitest';
import { boardSize } from '../edition';
import { createBoard, markAt } from '../board';
import { fireAt } from '../resolve';
import { isUntried, viewOf } from './index';
import { isStaleMiss, STALE_AFTER } from './view';
import { densityMap } from './density';
import type { Ship } from '../types';

const SIZE = boardSize('CLASSIC');
const at = (map: number[], row: number, col: number) => map[row * SIZE.cols + col];
const empty = () => createBoard(SIZE, [] as Ship[]);

describe('marks without MOBILE FLEET', () => {
	it('carry no turn and never go stale', () => {
		const board = empty();
		fireAt(board, { row: 3, col: 3 });

		const mark = markAt(board, { row: 3, col: 3 })!;
		expect(mark.turn).toBeUndefined();
		expect(isStaleMiss(mark, 99)).toBe(false);
		expect(isUntried(viewOf(board, 99), { row: 3, col: 3 })).toBe(false);
	});
});

describe('marks under MOBILE FLEET', () => {
	it('records the turn a miss was made', () => {
		const board = empty();
		fireAt(board, { row: 3, col: 3 }, true, 7);
		expect(markAt(board, { row: 3, col: 3 })).toEqual({ kind: 'miss', turn: 7 });
	});

	it('holds a miss for a few turns, then lets it go', () => {
		const board = empty();
		fireAt(board, { row: 3, col: 3 }, true, 0);
		const mark = markAt(board, { row: 3, col: 3 })!;

		expect(isStaleMiss(mark, STALE_AFTER)).toBe(false);
		expect(isStaleMiss(mark, STALE_AFTER + 1)).toBe(true);
	});

	it('never lets a hit go stale, because damaged ships hold position', () => {
		const board = createBoard(SIZE, [{ class: 'PB', bow: { row: 0, col: 0 }, facing: 'W' }]);
		fireAt(board, { row: 0, col: 0 }, true, 0);

		const mark = markAt(board, { row: 0, col: 0 })!;
		expect(mark.kind).toBe('hit');
		expect(isStaleMiss(mark, 100)).toBe(false);
		expect(isUntried(viewOf(board, 100), { row: 0, col: 0 })).toBe(false);
	});

	it('lets a stale cell be fired at again', () => {
		const board = createBoard(SIZE, [{ class: 'PB', bow: { row: 0, col: 0 }, facing: 'W' }]);
		// Miss on empty water, then the hull sails in.
		fireAt(board, { row: 5, col: 5 }, true, 0);
		board.ships[0].bow = { row: 5, col: 5 };

		const again = fireAt(board, { row: 5, col: 5 }, true, 9);
		expect(again.repeat).toBe(false);
		expect(again.result).toBe('hit');
	});

	it('refuses the same re-fire when the rule is off', () => {
		const board = empty();
		fireAt(board, { row: 5, col: 5 });
		expect(fireAt(board, { row: 5, col: 5 }).repeat).toBe(true);
	});
});

describe('the density map with stale misses', () => {
	it('writes a stale cell back off zero, so the AI reconsiders it', () => {
		const board = empty();
		fireAt(board, { row: 5, col: 5 }, true, 0);

		expect(at(densityMap(viewOf(board, 1)), 5, 5)).toBe(0);
		expect(at(densityMap(viewOf(board, STALE_AFTER + 1)), 5, 5)).toBeGreaterThan(0);
	});

	it('keeps trusting a fresh miss', () => {
		const board = empty();
		fireAt(board, { row: 5, col: 5 }, true, 4);
		expect(at(densityMap(viewOf(board, 5)), 5, 5)).toBe(0);
	});

	it('goes on trusting every miss when the rule is off', () => {
		const board = empty();
		fireAt(board, { row: 5, col: 5 });
		expect(at(densityMap(viewOf(board)), 5, 5)).toBe(0);
		expect(at(densityMap(viewOf(board, 999)), 5, 5)).toBe(0);
	});
});
