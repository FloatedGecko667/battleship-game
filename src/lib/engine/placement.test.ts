import { describe, expect, it } from 'vitest';
import { canPlace, randomFleet, rotateWithKick } from './placement';
import { cellsOf, coordKey } from './geometry';
import { boardSize } from './edition';
import { FLEET, FLEET_CELLS } from './fleet';
import { mulberry32 } from './rng';
import type { Ship } from './types';

const CLASSIC = boardSize('CLASSIC');
const DELUXE = boardSize('DELUXE');

describe('canPlace', () => {
	it('rejects a hull that runs off the board', () => {
		expect(canPlace({ class: 'CV', bow: { row: 0, col: 0 }, facing: 'S' }, [], CLASSIC)).toBe(false);
		expect(canPlace({ class: 'CV', bow: { row: 0, col: 0 }, facing: 'N' }, [], CLASSIC)).toBe(true);
	});

	it('uses the wider DELUXE board for column bounds', () => {
		const ship: Ship = { class: 'PB', bow: { row: 0, col: 12 }, facing: 'W' };
		expect(canPlace(ship, [], CLASSIC)).toBe(false);
		expect(canPlace(ship, [], DELUXE)).toBe(true);
	});

	it('rejects overlapping hulls', () => {
		const carrier: Ship = { class: 'CV', bow: { row: 2, col: 2 }, facing: 'W' };
		const crossing: Ship = { class: 'BB', bow: { row: 0, col: 4 }, facing: 'N' };
		expect(canPlace(crossing, [carrier], CLASSIC)).toBe(false);
	});

	it('allows touching hulls by default but not under NO ADJACENCY', () => {
		const carrier: Ship = { class: 'CV', bow: { row: 2, col: 0 }, facing: 'W' };
		const alongside: Ship = { class: 'PB', bow: { row: 3, col: 0 }, facing: 'W' };
		expect(canPlace(alongside, [carrier], CLASSIC)).toBe(true);
		expect(canPlace(alongside, [carrier], CLASSIC, { noAdjacency: true })).toBe(false);
	});

	it('treats a diagonal touch as adjacency', () => {
		const carrier: Ship = { class: 'CV', bow: { row: 2, col: 2 }, facing: 'W' };
		const diagonal: Ship = { class: 'PB', bow: { row: 3, col: 1 }, facing: 'W' };
		expect(canPlace(diagonal, [carrier], CLASSIC, { noAdjacency: true })).toBe(false);
	});
});

describe('rotateWithKick', () => {
	it('keeps the bow fixed when the rotation already fits', () => {
		const ship: Ship = { class: 'DD', bow: { row: 4, col: 4 }, facing: 'N' };
		const rotated = rotateWithKick(ship, [ship], CLASSIC);
		expect(rotated).toEqual({ class: 'DD', bow: { row: 4, col: 4 }, facing: 'E' });
	});

	it('slides along the hull axis when the rotation would leave the board', () => {
		// Bow at column 0 facing N; rotating to E would put the stern at column -2.
		const ship: Ship = { class: 'DD', bow: { row: 4, col: 0 }, facing: 'N' };
		const rotated = rotateWithKick(ship, [ship], CLASSIC);
		expect(rotated?.facing).toBe('E');
		expect(cellsOf(rotated!).every((c) => c.col >= 0 && c.col < CLASSIC.cols)).toBe(true);
	});

	it('returns null when no offset frees the hull', () => {
		// A 2-wide corridor cannot hold a 5-cell carrier turned sideways.
		const carrier: Ship = { class: 'CV', bow: { row: 0, col: 0 }, facing: 'N' };
		const wall: Ship = { class: 'CV', bow: { row: 0, col: 1 }, facing: 'N' };
		const narrow = { rows: 5, cols: 2 };
		expect(rotateWithKick(carrier, [carrier, wall], narrow)).toBeNull();
	});
});

describe('randomFleet', () => {
	it('places all five ships without overlap on both editions', () => {
		for (const size of [CLASSIC, DELUXE]) {
			for (let seed = 0; seed < 50; seed++) {
				const fleet = randomFleet(size, mulberry32(seed));
				expect(fleet).toHaveLength(FLEET.length);

				const cells = fleet.flatMap(cellsOf);
				expect(cells).toHaveLength(FLEET_CELLS);
				expect(new Set(cells.map(coordKey)).size).toBe(FLEET_CELLS);
				expect(
					cells.every((c) => c.row >= 0 && c.row < size.rows && c.col >= 0 && c.col < size.cols)
				).toBe(true);
			}
		}
	});

	it('honours NO ADJACENCY', () => {
		const fleet = randomFleet(CLASSIC, mulberry32(7), { noAdjacency: true });
		for (const ship of fleet) {
			const others = fleet.filter((s) => s !== ship);
			expect(canPlace(ship, others, CLASSIC, { noAdjacency: true })).toBe(true);
		}
	});

	it('is reproducible for a given seed', () => {
		expect(randomFleet(DELUXE, mulberry32(42))).toEqual(randomFleet(DELUXE, mulberry32(42)));
	});
});
