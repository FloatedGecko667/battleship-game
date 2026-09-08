import { describe, expect, it } from 'vitest';
import { boardSize } from '../edition';
import { createBoard, markAt } from '../board';
import { fireAt } from '../resolve';
import { cellsOf } from '../geometry';
import {
	availableWeapons,
	emptyArsenal,
	fireWeapon,
	isAvailable,
	previewCells,
	roundsLeft,
	weaponSpec,
	WEAPONS
} from './index';
import type { Ship } from '../types';

const SIZE = boardSize('CLASSIC');

/** Own fleet, for availability checks. */
function ownBoard() {
	return createBoard(SIZE, [
		{ class: 'BB', bow: { row: 0, col: 0 }, facing: 'W' },
		{ class: 'DD', bow: { row: 2, col: 0 }, facing: 'W' },
		{ class: 'DE', bow: { row: 4, col: 0 }, facing: 'W' }
	] as Ship[]);
}

/** Enemy fleet: a CV lying across E3-E7. */
function targetBoard() {
	return createBoard(SIZE, [{ class: 'CV', bow: { row: 4, col: 2 }, facing: 'W' }] as Ship[]);
}

describe('availability', () => {
	it('needs the ship that carries it to be afloat', () => {
		const own = ownBoard();
		const arsenal = emptyArsenal();
		const bb = weaponSpec('BB_MISSILE');
		expect(isAvailable(bb, own, arsenal)).toBe(true);

		for (const cell of cellsOf(own.ships[0])) fireAt(own, cell);
		expect(isAvailable(bb, own, arsenal)).toBe(false);
	});

	it('runs the battleship missile dry after one shot', () => {
		const own = ownBoard();
		const arsenal = emptyArsenal();
		const bb = weaponSpec('BB_MISSILE');

		expect(roundsLeft(bb, arsenal)).toBe(1);
		arsenal.BB_MISSILE = 1;
		expect(roundsLeft(bb, arsenal)).toBe(0);
		expect(isAvailable(bb, own, arsenal)).toBe(false);
	});

	it('gives the destroyer two rounds and the escort two homing missiles', () => {
		const arsenal = emptyArsenal();
		expect(roundsLeft(weaponSpec('DD_MISSILE'), arsenal)).toBe(2);
		expect(roundsLeft(weaponSpec('DE_HOMING'), arsenal)).toBe(2);
	});

	it('never exhausts the sonar', () => {
		const arsenal = emptyArsenal();
		arsenal.DE_SONAR = 99;
		expect(roundsLeft(weaponSpec('DE_SONAR'), arsenal)).toBe(Infinity);
		expect(isAvailable(weaponSpec('DE_SONAR'), ownBoard(), arsenal)).toBe(true);
	});

	it('loses both escort weapons together when the escort sinks', () => {
		const own = ownBoard();
		for (const cell of cellsOf(own.ships[2])) fireAt(own, cell);
		const ids = availableWeapons(own, emptyArsenal()).map((w) => w.id);
		expect(ids).not.toContain('DE_HOMING');
		expect(ids).not.toContain('DE_SONAR');
		expect(ids).toContain('BB_MISSILE');
	});

	it('covers every weapon with a spec', () => {
		expect(WEAPONS.map((w) => w.id).sort()).toEqual([
			'BB_MISSILE',
			'DD_MISSILE',
			'DE_HOMING',
			'DE_SONAR'
		]);
	});
});

describe('battleship missile', () => {
	it('resolves all nine cells at once', () => {
		const target = targetBoard();
		const { events, fired } = fireWeapon(target, { weapon: 'BB_MISSILE', at: { row: 4, col: 4 } }, 'player');

		expect(fired).toBe(true);
		const shots = events.filter((e) => e.type === 'shot');
		expect(shots).toHaveLength(9);
		expect(shots.filter((e) => e.type === 'shot' && e.result === 'hit')).toHaveLength(3);
	});

	it('is legal at the edge, covering fewer cells', () => {
		const target = targetBoard();
		const { events } = fireWeapon(target, { weapon: 'BB_MISSILE', at: { row: 0, col: 0 } }, 'player');
		expect(events.filter((e) => e.type === 'shot')).toHaveLength(4);
	});
});

describe('destroyer missile', () => {
	it('strikes three cells along the chosen axis', () => {
		const target = targetBoard();
		const { events } = fireWeapon(
			target,
			{ weapon: 'DD_MISSILE', at: { row: 4, col: 4 }, orientation: 'H' },
			'player'
		);
		const shots = events.filter((e) => e.type === 'shot');
		expect(shots).toHaveLength(3);
		expect(shots.every((e) => e.type === 'shot' && e.result === 'hit')).toBe(true);
	});

	it('mostly misses when fired across the hull', () => {
		const target = targetBoard();
		const { events } = fireWeapon(
			target,
			{ weapon: 'DD_MISSILE', at: { row: 4, col: 4 }, orientation: 'V' },
			'player'
		);
		const hits = events.filter((e) => e.type === 'shot' && e.result === 'hit');
		expect(hits).toHaveLength(1);
	});
});

describe('homing missile', () => {
	it('stops at the first ship and misses everything before it', () => {
		const target = targetBoard();
		const { events } = fireWeapon(
			target,
			{ weapon: 'DE_HOMING', at: { row: 4, col: 0 }, orientation: 'H' },
			'player'
		);

		const shots = events.filter((e) => e.type === 'shot');
		// E1 and E2 are water, E3 is the carrier's stern - and that is where it stops.
		expect(shots).toHaveLength(3);
		expect(shots.slice(0, 2).every((e) => e.type === 'shot' && e.result === 'miss')).toBe(true);
		expect(shots[2]).toMatchObject({ result: 'hit', coord: { row: 4, col: 2 } });
		expect(markAt(target, { row: 4, col: 3 })).toBeNull();
	});

	it('paints the whole lane when it finds nothing', () => {
		const target = targetBoard();
		const { events } = fireWeapon(
			target,
			{ weapon: 'DE_HOMING', at: { row: 0, col: 0 }, orientation: 'H' },
			'player'
		);
		const shots = events.filter((e) => e.type === 'shot');
		expect(shots).toHaveLength(10);
		expect(shots.every((e) => e.type === 'shot' && e.result === 'miss')).toBe(true);
	});

	it('spends no round on a launch that is not on an edge', () => {
		const target = targetBoard();
		const outcome = fireWeapon(
			target,
			{ weapon: 'DE_HOMING', at: { row: 4, col: 4 }, orientation: 'H' },
			'player'
		);
		expect(outcome.fired).toBe(false);
		expect(outcome.events).toEqual([]);
	});
});

describe('sonar', () => {
	it('reports a contact without saying where or how many', () => {
		const target = targetBoard();
		const { events } = fireWeapon(target, { weapon: 'DE_SONAR', at: { row: 4, col: 3 } }, 'player');

		expect(events).toEqual([
			{ type: 'scan', side: 'player', coord: { row: 4, col: 3 }, detected: true }
		]);
		// Nothing was damaged and no position leaked onto the board.
		expect(target.ships[0].hits.some(Boolean)).toBe(false);
		expect(markAt(target, { row: 4, col: 3 })).toEqual({ kind: 'scan' });
	});

	it('reports clear water', () => {
		const target = targetBoard();
		const { events } = fireWeapon(target, { weapon: 'DE_SONAR', at: { row: 8, col: 8 } }, 'player');
		expect(events[0]).toMatchObject({ type: 'scan', detected: false });
	});

	it('does not paint over an established shot result', () => {
		const target = targetBoard();
		fireAt(target, { row: 8, col: 8 });
		fireWeapon(target, { weapon: 'DE_SONAR', at: { row: 8, col: 8 } }, 'player');
		expect(markAt(target, { row: 8, col: 8 })).toEqual({ kind: 'miss' });
	});
});

describe('previewCells', () => {
	it('shows the whole homing lane, not where it will stop', () => {
		const target = targetBoard();
		const lane = previewCells(
			{ weapon: 'DE_HOMING', at: { row: 4, col: 0 }, orientation: 'H' },
			target
		);
		// A preview that stopped at the carrier would leak the enemy's position.
		expect(lane).toHaveLength(10);
	});

	it('matches what each weapon resolves', () => {
		const target = targetBoard();
		expect(previewCells({ weapon: 'BB_MISSILE', at: { row: 5, col: 5 } }, target)).toHaveLength(9);
		expect(
			previewCells({ weapon: 'DD_MISSILE', at: { row: 5, col: 5 }, orientation: 'V' }, target)
		).toHaveLength(3);
		expect(previewCells({ weapon: 'DE_SONAR', at: { row: 5, col: 5 } }, target)).toHaveLength(9);
	});
});
