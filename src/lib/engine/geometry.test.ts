import { describe, expect, it } from 'vitest';
import { cellsOf, kickOffsets, rotateCW } from './geometry';
import type { Ship } from './types';

describe('cellsOf', () => {
	const bow = { row: 4, col: 4 };

	it('extends the hull backwards from the bow in each facing', () => {
		const cases: Array<[Ship['facing'], Array<[number, number]>]> = [
			['N', [[4, 4], [5, 4], [6, 4]]],
			['S', [[4, 4], [3, 4], [2, 4]]],
			['E', [[4, 4], [4, 3], [4, 2]]],
			['W', [[4, 4], [4, 5], [4, 6]]]
		];

		for (const [facing, expected] of cases) {
			const cells = cellsOf({ class: 'DD', bow, facing });
			expect(cells.map((c) => [c.row, c.col])).toEqual(expected);
		}
	});

	it('produces one cell per hull length, bow first', () => {
		expect(cellsOf({ class: 'CV', bow, facing: 'N' })).toHaveLength(5);
		expect(cellsOf({ class: 'PB', bow, facing: 'N' })).toHaveLength(2);
		expect(cellsOf({ class: 'PB', bow, facing: 'N' })[0]).toEqual(bow);
	});
});

describe('rotateCW', () => {
	it('cycles N -> E -> S -> W -> N', () => {
		expect(rotateCW('N')).toBe('E');
		expect(rotateCW('E')).toBe('S');
		expect(rotateCW('S')).toBe('W');
		expect(rotateCW('W')).toBe('N');
	});
});

describe('kickOffsets', () => {
	it('tries the unshifted position first, then alternates outwards', () => {
		const offsets = kickOffsets('N', 3);
		expect(offsets[0]).toEqual({ row: 0, col: 0 });
		expect(offsets).toHaveLength(5); // 1 + 2 * (length - 1)
		expect(offsets.slice(1, 3)).toEqual([
			{ row: 1, col: 0 },
			{ row: -1, col: 0 }
		]);
	});
});
