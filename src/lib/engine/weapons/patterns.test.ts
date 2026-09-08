import { describe, expect, it } from 'vitest';
import { boardSize } from '../edition';
import { block3x3, homingLane, launchCells, line3 } from './patterns';

const CLASSIC = boardSize('CLASSIC');
const DELUXE = boardSize('DELUXE');
const keys = (cells: { row: number; col: number }[]) => cells.map((c) => `${c.row},${c.col}`);

describe('block3x3', () => {
	it('covers nine cells away from the edges', () => {
		expect(block3x3({ row: 5, col: 5 }, CLASSIC)).toHaveLength(9);
	});

	it('clips against a corner instead of failing', () => {
		const cells = block3x3({ row: 0, col: 0 }, CLASSIC);
		expect(cells).toHaveLength(4);
		expect(keys(cells)).toEqual(['0,0', '0,1', '1,0', '1,1']);
	});

	it('clips against an edge', () => {
		expect(block3x3({ row: 0, col: 5 }, CLASSIC)).toHaveLength(6);
		expect(block3x3({ row: 9, col: 13 }, DELUXE)).toHaveLength(4);
	});
});

describe('line3', () => {
	it('runs three cells through the centre on each axis', () => {
		expect(keys(line3({ row: 4, col: 4 }, 'H', CLASSIC))).toEqual(['4,3', '4,4', '4,5']);
		expect(keys(line3({ row: 4, col: 4 }, 'V', CLASSIC))).toEqual(['3,4', '4,4', '5,4']);
	});

	it('clips at the board edge', () => {
		expect(keys(line3({ row: 0, col: 0 }, 'H', CLASSIC))).toEqual(['0,0', '0,1']);
		expect(keys(line3({ row: 9, col: 13 }, 'V', DELUXE))).toEqual(['8,13', '9,13']);
	});
});

describe('homingLane', () => {
	it('crosses the board from the launch edge', () => {
		const lane = homingLane({ row: 3, col: 0 }, 'H', CLASSIC);
		expect(lane).toHaveLength(10);
		expect(lane[0]).toEqual({ row: 3, col: 0 });
		expect(lane[9]).toEqual({ row: 3, col: 9 });
	});

	it('runs the other way when launched from the far edge', () => {
		const lane = homingLane({ row: 3, col: 13 }, 'H', DELUXE);
		expect(lane).toHaveLength(14);
		expect(lane[1]).toEqual({ row: 3, col: 12 });
	});

	it('runs down or up the board on the vertical axis', () => {
		expect(homingLane({ row: 0, col: 6 }, 'V', CLASSIC)[1]).toEqual({ row: 1, col: 6 });
		expect(homingLane({ row: 9, col: 6 }, 'V', CLASSIC)[1]).toEqual({ row: 8, col: 6 });
	});

	it('refuses a launch that is not on an edge of the chosen axis', () => {
		// Mid-board, and a left-edge cell fired along the vertical axis.
		expect(homingLane({ row: 4, col: 4 }, 'H', CLASSIC)).toEqual([]);
		expect(homingLane({ row: 4, col: 0 }, 'V', CLASSIC)).toEqual([]);
	});
});

describe('launchCells', () => {
	it('offers both ends of every rank or file', () => {
		expect(launchCells('H', DELUXE)).toHaveLength(20); // 10 ranks, two ends
		expect(launchCells('V', DELUXE)).toHaveLength(28); // 14 files, two ends
		expect(launchCells('H', DELUXE).every((c) => homingLane(c, 'H', DELUXE).length === 14)).toBe(
			true
		);
	});
});
