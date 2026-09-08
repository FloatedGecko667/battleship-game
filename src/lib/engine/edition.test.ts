import { describe, expect, it } from 'vitest';
import { boardSize, coordLabel, parseCoord, RANKS } from './edition';

describe('board sizes', () => {
	it('is 10x10 for CLASSIC and 14 wide for DELUXE', () => {
		expect(boardSize('CLASSIC')).toEqual({ rows: 10, cols: 10 });
		expect(boardSize('DELUXE')).toEqual({ rows: 10, cols: 14 });
	});

	it('has ten ranks, A through J', () => {
		expect(RANKS).toHaveLength(10);
		expect(RANKS[0]).toBe('A');
		expect(RANKS[9]).toBe('J');
	});
});

describe('coordinate labels', () => {
	it('is one-based on the file and letter-based on the rank', () => {
		expect(coordLabel(0, 0)).toBe('A1');
		expect(coordLabel(9, 13)).toBe('J14');
	});

	it('round-trips through parseCoord', () => {
		const deluxe = boardSize('DELUXE');
		expect(parseCoord('J14', deluxe)).toEqual({ row: 9, col: 13 });
		expect(parseCoord('b5', deluxe)).toEqual({ row: 1, col: 4 });
	});

	it('rejects coordinates outside the edition board', () => {
		expect(parseCoord('J14', boardSize('CLASSIC'))).toBeNull();
		expect(parseCoord('K1', boardSize('DELUXE'))).toBeNull();
		expect(parseCoord('A0', boardSize('DELUXE'))).toBeNull();
		expect(parseCoord('nonsense', boardSize('DELUXE'))).toBeNull();
	});
});
