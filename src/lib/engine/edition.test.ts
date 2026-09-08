import { describe, expect, it } from 'vitest';
import { boardSize, coordLabel, parseCoord, phoneticLabel, PHONETIC, RANKS } from './edition';

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

describe('phonetic labels', () => {
	it('spells the rank the way the unit calls it', () => {
		expect(phoneticLabel(0, 0)).toBe('Alpha 1');
		expect(phoneticLabel(3, 6)).toBe('Delta 7');
		expect(phoneticLabel(9, 13)).toBe('Juliet 14');
	});

	it('covers every rank', () => {
		expect(RANKS.map((r) => PHONETIC[r])).toEqual([
			'Alpha',
			'Bravo',
			'Charlie',
			'Delta',
			'Echo',
			'Foxtrot',
			'Golf',
			'Hotel',
			'India',
			'Juliet'
		]);
	});
});
