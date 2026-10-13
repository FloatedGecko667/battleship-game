import { describe, expect, it } from 'vitest';
import { fleetCells, fleetClasses, fleetFor, hullCode, shipLength } from './fleet';
import { boardSize } from './edition';
import { createBoard } from './board';
import { randomFleet } from './placement';
import { mulberry32 } from './rng';

describe('the two fleets', () => {
	it('gives CLASSIC the 1990 fleet, submarine included', () => {
		expect(fleetClasses('CLASSIC')).toEqual(['CV', 'BB', 'CA', 'SS', 'DD2']);
		expect(fleetFor('CLASSIC').map((s) => s.length)).toEqual([5, 4, 3, 3, 2]);
	});

	it('keeps DELUXE on the rulebook fleet', () => {
		expect(fleetClasses('DELUXE')).toEqual(['CV', 'BB', 'DD', 'DE', 'PB']);
	});

	it('comes to 17 hull cells either way', () => {
		expect(fleetCells('CLASSIC')).toBe(17);
		expect(fleetCells('DELUXE')).toBe(17);
	});

	it('draws both destroyers as DD without confusing their lengths', () => {
		expect(hullCode('DD2')).toBe('DD');
		expect(hullCode('DD')).toBe('DD');
		expect(shipLength('DD2')).toBe(2);
		expect(shipLength('DD')).toBe(3);
	});

	it('deals each edition only its own ships', () => {
		for (let seed = 0; seed < 20; seed++) {
			const classic = randomFleet(boardSize('CLASSIC'), mulberry32(seed), fleetClasses('CLASSIC'));
			const classes = classic.map((s) => s.class);
			expect(classes).toContain('SS');
			expect(classes).not.toContain('DE');
			expect(classes).not.toContain('PB');
			expect(createBoard(boardSize('CLASSIC'), classic).ships).toHaveLength(5);
		}
	});
});
