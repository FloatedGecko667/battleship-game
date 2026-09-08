import { describe, expect, it } from 'vitest';
import { boardSize } from './edition';
import { createBoard } from './board';
import { fireAt } from './resolve';
import { cellsOf } from './geometry';
import { canGetUnderWay, moveShip, movedShip, previewMove, shipsUnderWay } from './movement';
import type { Ship } from './types';

const SIZE = boardSize('CLASSIC');

function board(ships: Ship[]) {
	return createBoard(SIZE, ships);
}

describe('getting under way', () => {
	it('steps a hull one cell along its own axis', () => {
		// A destroyer at E5-E7 facing west: the bow is the western end.
		const b = board([{ class: 'DD', bow: { row: 4, col: 4 }, facing: 'W' }]);
		const ship = b.ships[0];

		expect(movedShip(ship, 'ahead', b.ships, SIZE)?.bow).toEqual({ row: 4, col: 3 });
		expect(movedShip(ship, 'astern', b.ships, SIZE)?.bow).toEqual({ row: 4, col: 5 });
	});

	it('moves along the facing, not the screen', () => {
		const b = board([{ class: 'DD', bow: { row: 4, col: 4 }, facing: 'N' }]);
		expect(movedShip(b.ships[0], 'ahead', b.ships, SIZE)?.bow).toEqual({ row: 3, col: 4 });
	});

	it('will not sail off the board', () => {
		const b = board([{ class: 'DD', bow: { row: 4, col: 0 }, facing: 'W' }]);
		expect(movedShip(b.ships[0], 'ahead', b.ships, SIZE)).toBeNull();
		expect(movedShip(b.ships[0], 'astern', b.ships, SIZE)).not.toBeNull();
	});

	it('will not sail through another hull', () => {
		const b = board([
			{ class: 'DD', bow: { row: 4, col: 4 }, facing: 'W' },
			{ class: 'PB', bow: { row: 4, col: 3 }, facing: 'W' }
		]);
		expect(movedShip(b.ships[0], 'ahead', b.ships, SIZE)).toBeNull();
	});

	it('honours NO ADJACENCY when it is on', () => {
		const b = board([
			{ class: 'DD', bow: { row: 4, col: 4 }, facing: 'W' },
			{ class: 'PB', bow: { row: 5, col: 2 }, facing: 'W' }
		]);
		expect(movedShip(b.ships[0], 'ahead', b.ships, SIZE)).not.toBeNull();
		expect(movedShip(b.ships[0], 'ahead', b.ships, SIZE, { noAdjacency: true })).toBeNull();
	});
});

describe('damaged ships', () => {
	/**
	 * The rule leans on this: hit marks record what the enemy saw and never
	 * move, so a damaged hull sailing away would leave them describing water.
	 */
	it('cannot get under way once anything has hit them', () => {
		const b = board([{ class: 'DD', bow: { row: 4, col: 4 }, facing: 'W' }]);
		const ship = b.ships[0];
		expect(canGetUnderWay(ship)).toBe(true);

		fireAt(b, cellsOf(ship)[1]);
		expect(canGetUnderWay(ship)).toBe(false);
		expect(movedShip(ship, 'ahead', b.ships, SIZE)).toBeNull();
		expect(moveShip(b, ship, 'ahead')).toBe(false);
	});

	it('leaves them out of the list of ships that can move', () => {
		const b = board([
			{ class: 'DD', bow: { row: 4, col: 4 }, facing: 'W' },
			{ class: 'PB', bow: { row: 8, col: 4 }, facing: 'W' }
		]);
		expect(shipsUnderWay(b)).toHaveLength(2);

		fireAt(b, cellsOf(b.ships[0])[0]);
		expect(shipsUnderWay(b).map((s) => s.class)).toEqual(['PB']);
	});
});

describe('moveShip', () => {
	it('updates the hull in place and reports success', () => {
		const b = board([{ class: 'DD', bow: { row: 4, col: 4 }, facing: 'W' }]);
		expect(moveShip(b, b.ships[0], 'ahead')).toBe(true);
		expect(b.ships[0].bow).toEqual({ row: 4, col: 3 });
	});

	it('leaves the hull alone when the move is illegal', () => {
		const b = board([{ class: 'DD', bow: { row: 4, col: 0 }, facing: 'W' }]);
		expect(moveShip(b, b.ships[0], 'ahead')).toBe(false);
		expect(b.ships[0].bow).toEqual({ row: 4, col: 0 });
	});

	it('previews exactly where the hull would end up', () => {
		const b = board([{ class: 'DD', bow: { row: 4, col: 4 }, facing: 'W' }]);
		const preview = previewMove(b.ships[0], 'ahead', b.ships, SIZE);
		expect(preview.map((c) => `${c.row},${c.col}`)).toEqual(['4,3', '4,4', '4,5']);
	});

	it('previews nothing when the ship cannot move', () => {
		const b = board([{ class: 'DD', bow: { row: 4, col: 0 }, facing: 'W' }]);
		expect(previewMove(b.ships[0], 'ahead', b.ships, SIZE)).toEqual([]);
	});
});
