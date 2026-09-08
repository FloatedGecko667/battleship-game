import { describe, expect, it } from 'vitest';
import { boardSize } from '../edition';
import { createBoard, markAt } from '../board';
import { fireAt } from '../resolve';
import {
	fireAntiAir,
	flySweep,
	grounded,
	liveAircraft,
	loseGroundedAt,
	newAircraft,
	scanCells
} from './aircraft';
import type { Ship } from '../types';

const SIZE = boardSize('DELUXE');
const keys = (cells: { row: number; col: number }[]) =>
	cells.map((c) => `${c.row},${c.col}`).sort();

/** A carrier lying across E3-E7. */
function targetBoard() {
	return createBoard(SIZE, [{ class: 'CV', bow: { row: 4, col: 2 }, facing: 'W' }] as Ship[]);
}

describe('scanCells', () => {
	it('covers the centre and four neighbours on each pattern', () => {
		expect(keys(scanCells({ row: 5, col: 5 }, 'PLUS', SIZE))).toEqual(
			['4,5', '5,4', '5,5', '5,6', '6,5'].sort()
		);
		expect(keys(scanCells({ row: 5, col: 5 }, 'X', SIZE))).toEqual(
			['4,4', '4,6', '5,5', '6,4', '6,6'].sort()
		);
	});

	it('clips against the board edge', () => {
		expect(scanCells({ row: 0, col: 0 }, 'PLUS', SIZE)).toHaveLength(3);
		expect(scanCells({ row: 0, col: 0 }, 'X', SIZE)).toHaveLength(2);
	});
});

describe('an armed sweep', () => {
	it('hits everything it finds and marks the rest as water', () => {
		const target = targetBoard();
		// Centred on E5: the plus pattern crosses the carrier at E4, E5 and E6.
		const { events, spentAmmo } = flySweep(target, { row: 4, col: 4 }, 'PLUS', true, 'player');

		expect(spentAmmo).toBe(true);
		const shots = events.filter((e) => e.type === 'shot');
		expect(shots).toHaveLength(5);
		expect(shots.filter((e) => e.type === 'shot' && e.result === 'hit')).toHaveLength(3);
		expect(shots.filter((e) => e.type === 'shot' && e.result === 'miss')).toHaveLength(2);
	});

	it('keeps its strike when it finds nothing', () => {
		const target = targetBoard();
		const { events, spentAmmo } = flySweep(target, { row: 8, col: 9 }, 'PLUS', true, 'player');

		// Clear water still gets recorded, but the aircraft has not fired.
		expect(spentAmmo).toBe(false);
		expect(events.filter((e) => e.type === 'shot')).toHaveLength(5);
		expect(markAt(target, { row: 8, col: 9 })).toEqual({ kind: 'miss' });
	});
});

describe('a spent sweep', () => {
	it('reports a contact without doing damage', () => {
		const target = targetBoard();
		const { events, spentAmmo } = flySweep(target, { row: 4, col: 4 }, 'PLUS', false, 'player');

		expect(spentAmmo).toBe(false);
		expect(events).toEqual([
			{ type: 'scan', side: 'player', coord: { row: 4, col: 4 }, detected: true }
		]);
		expect(target.ships[0].hits.some(Boolean)).toBe(false);
	});

	it('reports clear water', () => {
		const target = targetBoard();
		const { events } = flySweep(target, { row: 9, col: 9 }, 'PLUS', false, 'player');
		expect(events[0]).toMatchObject({ type: 'scan', detected: false });
	});

	it('leaves an established shot result alone', () => {
		const target = targetBoard();
		fireAt(target, { row: 9, col: 9 });
		flySweep(target, { row: 9, col: 9 }, 'PLUS', false, 'player');
		expect(markAt(target, { row: 9, col: 9 })).toEqual({ kind: 'miss' });
	});
});

describe('losing aircraft', () => {
	it('loses a plane still on deck when its carrier cell is hit', () => {
		const flight = [newAircraft(0, { row: 4, col: 3 }), newAircraft(1, { row: 4, col: 5 })];

		expect(grounded(flight)).toHaveLength(2);
		const lost = loseGroundedAt(flight, { row: 4, col: 3 });

		expect(lost).toHaveLength(1);
		expect(liveAircraft(flight)).toHaveLength(1);
	});

	it('spares a plane that has already launched', () => {
		const flight = [newAircraft(0, { row: 4, col: 3 })];
		flight[0].at = { row: 2, col: 2 };

		expect(loseGroundedAt(flight, { row: 4, col: 3 })).toHaveLength(0);
		expect(liveAircraft(flight)).toHaveLength(1);
	});

	it('shoots down a plane hovering over the cell that was fired at', () => {
		const flight = [newAircraft(0, { row: 4, col: 3 })];
		flight[0].at = { row: 7, col: 7 };

		expect(fireAntiAir(flight, { row: 1, col: 1 })).toBeNull();
		expect(fireAntiAir(flight, { row: 7, col: 7 })).toMatchObject({ id: 0 });
		expect(liveAircraft(flight)).toHaveLength(0);
	});

	it('cannot shoot down a plane that never launched', () => {
		const flight = [newAircraft(0, { row: 4, col: 3 })];
		expect(fireAntiAir(flight, { row: 4, col: 3 })).toBeNull();
	});
});
