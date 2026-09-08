import { describe, expect, it } from 'vitest';
import { FORMATIONS, FORMATION_IDS, type Formation } from './formations';
import { boardSize } from '$lib/engine/edition';
import { cellsOf, coordKey } from '$lib/engine/geometry';
import { canPlace } from '$lib/engine/placement';
import { coordLabel } from '$lib/engine/edition';
import { FLEET_CELLS } from '$lib/engine/fleet';

const DELUXE = boardSize('DELUXE');
const entries = Object.entries(FORMATIONS) as [string, Formation][];

describe('the formation table', () => {
	it('holds all one hundred, A1 through J10', () => {
		expect(FORMATION_IDS).toHaveLength(100);
		for (const rank of 'ABCDEFGHIJ') {
			for (let n = 1; n <= 10; n++) expect(FORMATION_IDS).toContain(`${rank}${n}`);
		}
	});
});

describe.each(entries)('formation %s', (id, formation) => {
	it('carries one of each hull', () => {
		expect(formation.ships.map((s) => s.class).sort()).toEqual(['BB', 'CV', 'DD', 'DE', 'PB']);
	});

	it('fits the 14-wide board without overlapping', () => {
		const cells = formation.ships.flatMap(cellsOf);
		expect(cells).toHaveLength(FLEET_CELLS);
		expect(new Set(cells.map(coordKey)).size).toBe(FLEET_CELLS);

		for (const ship of formation.ships) {
			const others = formation.ships.filter((s) => s !== ship);
			expect(canPlace(ship, others, DELUXE)).toBe(true);
		}
	});

	it('parks both aircraft on the carrier', () => {
		expect(formation.aircraft).toHaveLength(2);

		const carrier = formation.ships.find((s) => s.class === 'CV')!;
		const deck = new Set(cellsOf(carrier).map(coordKey));
		for (const plane of formation.aircraft) expect(deck.has(coordKey(plane))).toBe(true);

		// The two planes never share a deck cell.
		expect(new Set(formation.aircraft.map(coordKey)).size).toBe(2);
	});
});

/**
 * The reading of A1 taken by eye off the rendered page, before the extractor
 * existed. It is the one check that the whole pipeline is aimed correctly.
 */
describe('A1 against the page it came from', () => {
	const byClass = Object.fromEntries(FORMATIONS.A1.ships.map((s) => [s.class, s]));

	it('places every hull where the diagram shows it', () => {
		expect(byClass.DE).toMatchObject({ bow: { row: 1, col: 3 }, facing: 'W' }); // B4-B6
		expect(byClass.BB).toMatchObject({ bow: { row: 4, col: 9 }, facing: 'W' }); // E10-E13
		expect(byClass.CV).toMatchObject({ bow: { row: 6, col: 6 }, facing: 'W' }); // G7-G11
		expect(byClass.PB).toMatchObject({ bow: { row: 6, col: 13 }, facing: 'N' }); // G14-H14
		expect(byClass.DD).toMatchObject({ bow: { row: 8, col: 1 }, facing: 'W' }); // I2-I4
	});

	it('puts the aircraft on G8 and G10', () => {
		expect(FORMATIONS.A1.aircraft.map((a) => coordLabel(a.row, a.col)).sort()).toEqual([
			'G10',
			'G8'
		]);
	});
});
