import { describe, expect, it } from 'vitest';
import { boardSize } from './edition';
import { createBoard, markAt } from './board';
import { cellsOf } from './geometry';
import { earnsExtraTurn, fireAt, shotEvents, shotsPerTurn } from './resolve';
import { DEFAULT_RULES, effectiveRules, NO_HOUSE_RULES, type RuleSet } from './ruleset';
import { sunkClasses, viewOf } from './ai/view';
import type { Ship } from './types';

const SIZE = boardSize('CLASSIC');

function rules(partial: Partial<RuleSet>): RuleSet {
	return { ...DEFAULT_RULES, house: { ...NO_HOUSE_RULES }, ...partial };
}

describe('effectiveRules', () => {
	it('folds the CLASSIC house toggles straight through', () => {
		const eff = effectiveRules(
			rules({ house: { ...NO_HOUSE_RULES, salvo: true, bonusTurn: true, sunkSilence: true } })
		);
		expect(eff).toEqual({
			salvo: true,
			extraTurnOnHit: true,
			extraTurnOnScan: false,
			noAdjacency: false,
			sunkSilence: true,
			advancedWeapons: false,
			mobileFleet: false
		});
	});

	it('drives DELUXE from the official game type instead', () => {
		expect(effectiveRules(rules({ edition: 'DELUXE', gameType: 'SALVO' })).salvo).toBe(true);

		const multi = effectiveRules(rules({ edition: 'DELUXE', gameType: 'MULTI_ATTACK' }));
		expect(multi.extraTurnOnHit).toBe(true);
		// The rulebook grants the extra turn on a sonar detection too.
		expect(multi.extraTurnOnScan).toBe(true);
	});

	it('refuses SUNK SILENCE on DELUXE, which always names the sunk ship', () => {
		const eff = effectiveRules(
			rules({ edition: 'DELUXE', house: { ...NO_HOUSE_RULES, sunkSilence: true } })
		);
		expect(eff.sunkSilence).toBe(false);
	});
});

describe('advanced weapons switch', () => {
	it('is available on DELUXE only', () => {
		expect(effectiveRules(rules({ edition: 'DELUXE', weapons: 'ADVANCED' })).advancedWeapons).toBe(
			true
		);
		// The special weapons come from the tie-in unit, so CLASSIC never has them.
		expect(effectiveRules(rules({ weapons: 'ADVANCED' })).advancedWeapons).toBe(false);
	});
});

describe('SALVO', () => {
	const board = () =>
		createBoard(SIZE, [
			{ class: 'PB', bow: { row: 0, col: 0 }, facing: 'W' },
			{ class: 'DD', bow: { row: 2, col: 0 }, facing: 'N' }
		] as Ship[]);

	it('gives one shot per turn when off', () => {
		expect(shotsPerTurn(board(), effectiveRules(rules({})))).toBe(1);
	});

	it('gives one shot per surviving ship when on', () => {
		const eff = effectiveRules(rules({ house: { ...NO_HOUSE_RULES, salvo: true } }));
		const b = board();
		expect(shotsPerTurn(b, eff)).toBe(2);

		for (const cell of cellsOf(b.ships[0])) fireAt(b, cell);
		expect(shotsPerTurn(b, eff)).toBe(1);
	});

	it('never drops below a single shot', () => {
		const eff = effectiveRules(rules({ house: { ...NO_HOUSE_RULES, salvo: true } }));
		const b = board();
		for (const ship of b.ships) for (const cell of cellsOf(ship)) fireAt(b, cell);
		expect(shotsPerTurn(b, eff)).toBe(1);
	});
});

describe('BONUS TURN', () => {
	const hit = shotEvents('player', { row: 0, col: 0 }, { result: 'hit', repeat: false });
	const miss = shotEvents('player', { row: 9, col: 9 }, { result: 'miss', repeat: false });

	it('is not granted when the rule is off', () => {
		expect(earnsExtraTurn(hit, effectiveRules(rules({})))).toBe(false);
	});

	it('is granted on a hit and withheld on a miss', () => {
		const eff = effectiveRules(rules({ house: { ...NO_HOUSE_RULES, bonusTurn: true } }));
		expect(earnsExtraTurn(hit, eff)).toBe(true);
		expect(earnsExtraTurn(miss, eff)).toBe(false);
	});

	it('is granted for a sonar contact only under MULTI-ATTACK', () => {
		const contact = [
			{ type: 'scan' as const, side: 'player' as const, coord: { row: 3, col: 3 }, detected: true }
		];
		const clear = [{ ...contact[0], detected: false }];
		const multi = effectiveRules(rules({ edition: 'DELUXE', gameType: 'MULTI_ATTACK' }));

		expect(earnsExtraTurn(contact, multi)).toBe(true);
		expect(earnsExtraTurn(clear, multi)).toBe(false);
		expect(
			earnsExtraTurn(contact, effectiveRules(rules({ house: { ...NO_HOUSE_RULES, bonusTurn: true } })))
		).toBe(false);
	});
});

describe('SUNK SILENCE', () => {
	it('sinks the ship but tells the shooter nothing', () => {
		const board = createBoard(SIZE, [{ class: 'PB', bow: { row: 0, col: 0 }, facing: 'W' }]);

		fireAt(board, { row: 0, col: 0 }, false);
		const last = fireAt(board, { row: 0, col: 1 }, false);

		// The hull really is down...
		expect(board.ships[0].hits.every(Boolean)).toBe(true);
		// ...but nothing about it reaches the shooter.
		expect(last.sunk).toBeUndefined();
		expect(markAt(board, { row: 0, col: 0 })?.revealedClass).toBeUndefined();
		expect(markAt(board, { row: 0, col: 1 })?.revealedClass).toBeUndefined();
		expect(sunkClasses(viewOf(board)).size).toBe(0);
	});

	it('announces normally when the rule is off', () => {
		const board = createBoard(SIZE, [{ class: 'PB', bow: { row: 0, col: 0 }, facing: 'W' }]);
		fireAt(board, { row: 0, col: 0 });
		expect(fireAt(board, { row: 0, col: 1 }).sunk).toBe('PB');
		expect([...sunkClasses(viewOf(board))]).toEqual(['PB']);
	});
});
