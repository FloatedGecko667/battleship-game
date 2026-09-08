import { describe, expect, it } from 'vitest';
import { boardSize } from './edition';
import { createBoard, isFleetDestroyed, markAt, survivingShips } from './board';
import { fireAt, markScan, shotEvents, victoryEvent } from './resolve';
import { cellsOf } from './geometry';
import type { Ship } from './types';

const SIZE = boardSize('CLASSIC');

/** A two-ship board: PB across A1-A2, DD down C1-C3. */
function testBoard() {
	const ships: Ship[] = [
		{ class: 'PB', bow: { row: 0, col: 0 }, facing: 'W' },
		{ class: 'DD', bow: { row: 2, col: 0 }, facing: 'N' }
	];
	return createBoard(SIZE, ships);
}

describe('fireAt', () => {
	it('misses empty water and records a miss mark', () => {
		const board = testBoard();
		const outcome = fireAt(board, { row: 5, col: 5 });
		expect(outcome).toEqual({ result: 'miss', repeat: false });
		expect(markAt(board, { row: 5, col: 5 })).toEqual({ kind: 'miss' });
	});

	it('hits a hull without revealing which ship it was', () => {
		const board = testBoard();
		const outcome = fireAt(board, { row: 0, col: 0 });
		expect(outcome.result).toBe('hit');
		expect(outcome.sunk).toBeUndefined();
		expect(markAt(board, { row: 0, col: 0 })).toEqual({ kind: 'hit' });
	});

	it('reveals the class only on the shot that sinks the ship', () => {
		const board = testBoard();
		fireAt(board, { row: 0, col: 0 });
		expect(markAt(board, { row: 0, col: 0 })?.revealedClass).toBeUndefined();

		const sinking = fireAt(board, { row: 0, col: 1 });
		expect(sinking.sunk).toBe('PB');
		// Both cells of the hull are now attributed to PB.
		expect(markAt(board, { row: 0, col: 0 })?.revealedClass).toBe('PB');
		expect(markAt(board, { row: 0, col: 1 })?.revealedClass).toBe('PB');
	});

	it('treats a repeated shot as a no-op', () => {
		const board = testBoard();
		fireAt(board, { row: 5, col: 5 });
		const again = fireAt(board, { row: 5, col: 5 });
		expect(again.repeat).toBe(true);
		expect(again.result).toBe('miss');
	});

	it('lets a shot land on a cell that was only scanned', () => {
		const board = testBoard();
		markScan(board, { row: 0, col: 0 });
		expect(markAt(board, { row: 0, col: 0 })).toEqual({ kind: 'scan' });

		const outcome = fireAt(board, { row: 0, col: 0 });
		expect(outcome.repeat).toBe(false);
		expect(outcome.result).toBe('hit');
	});
});

describe('markScan', () => {
	it('never paints over an established shot result', () => {
		const board = testBoard();
		fireAt(board, { row: 5, col: 5 });
		markScan(board, { row: 5, col: 5 });
		expect(markAt(board, { row: 5, col: 5 })).toEqual({ kind: 'miss' });
	});
});

describe('fleet status', () => {
	it('reports victory only once every ship is down', () => {
		const board = testBoard();
		for (const ship of board.ships) {
			for (const cell of cellsOf(ship)) {
				expect(isFleetDestroyed(board)).toBe(false);
				fireAt(board, cell);
			}
		}
		expect(isFleetDestroyed(board)).toBe(true);
		expect(survivingShips(board)).toHaveLength(0);
		expect(victoryEvent('player', board)).toEqual({ type: 'victory', side: 'player' });
	});

	it('has no victory event while a ship is afloat', () => {
		const board = testBoard();
		fireAt(board, { row: 0, col: 0 });
		expect(victoryEvent('player', board)).toBeNull();
	});
});

describe('shotEvents', () => {
	it('emits a shot event, and a sunk event attributed to the defender', () => {
		const events = shotEvents('player', { row: 0, col: 1 }, {
			result: 'hit',
			repeat: false,
			sunk: 'PB'
		});
		expect(events).toEqual([
			{ type: 'shot', side: 'player', coord: { row: 0, col: 1 }, result: 'hit' },
			{ type: 'sunk', side: 'cpu', shipClass: 'PB' }
		]);
	});

	it('emits only a repeat event for a wasted shot', () => {
		const events = shotEvents('cpu', { row: 3, col: 3 }, { result: 'miss', repeat: true });
		expect(events).toEqual([{ type: 'repeat', side: 'cpu', coord: { row: 3, col: 3 } }]);
	});
});
