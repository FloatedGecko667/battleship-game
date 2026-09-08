import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from './game.svelte';
import { Synth } from '$lib/audio/synth';
import { FakeAudioContext } from '$lib/audio/fakeContext';
import { untriedCells, viewOf } from '$lib/engine/ai';
import { sunkClasses } from '$lib/engine/ai/view';
import { shipAt } from '$lib/engine/board';
import { fireAt } from '$lib/engine/resolve';
import { cellsOf } from '$lib/engine/geometry';

function makeGame(seed = 42) {
	const contexts: FakeAudioContext[] = [];
	class Tracked extends FakeAudioContext {
		constructor() {
			super();
			contexts.push(this);
		}
	}
	const synth = new Synth(Tracked as unknown as new () => AudioContext);
	synth.unlock();
	const game = new Game(seed, synth);
	return { game, synth, ctx: () => contexts[0] };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('turn flow', () => {
	it('starts in deployment with a legal fleet and an empty enemy board', () => {
		const { game } = makeGame();
		expect(game.phase).toBe('deploy');
		expect(game.playerFleet).toHaveLength(5);
		expect(game.deploymentValid).toBe(true);
		expect(untriedCells(viewOf(game.cpuBoard))).toHaveLength(100);
	});

	it('hands the turn to the CPU and back after a shot', () => {
		const { game } = makeGame();
		game.startBattle();

		game.playerFire({ row: 0, col: 0 });
		expect(game.turn).toBe('cpu');

		vi.runAllTimers();
		expect(game.turn).toBe('player');
		// One shot each.
		expect(untriedCells(viewOf(game.cpuBoard))).toHaveLength(99);
		expect(untriedCells(viewOf(game.playerBoard))).toHaveLength(99);
	});

	it('ignores a shot while the CPU is thinking', () => {
		const { game } = makeGame();
		game.startBattle();
		game.playerFire({ row: 0, col: 0 });

		game.playerFire({ row: 5, col: 5 });
		expect(untriedCells(viewOf(game.cpuBoard))).toHaveLength(99);
	});

	it('lights the lamp to match the shot', () => {
		const { game } = makeGame();
		game.startBattle();

		const target = game.cpuBoard.ships[0];
		game.playerFire(cellsOf(target)[0]);
		expect(game.lamp).toBe('hit');

		vi.runAllTimers();
		const empty = untriedCells(viewOf(game.cpuBoard)).find((c) => !shipAt(game.cpuBoard, c));
		game.playerFire(empty!);
		expect(game.lamp).toBe('miss');
	});

	it('ends the game once a whole fleet is down', () => {
		const { game } = makeGame();
		game.startBattle();

		for (const ship of game.cpuBoard.ships) {
			for (const cell of cellsOf(ship)) {
				if (game.phase !== 'battle') break;
				game.playerFire(cell);
				vi.runAllTimers();
			}
		}

		expect(game.phase).toBe('result');
		expect(game.winner).toBe('player');
	});
});

describe('deployment controls', () => {
	it('rotates the selected ship and keeps the fleet legal', () => {
		const { game } = makeGame();
		const before = game.playerFleet[game.selected].facing;
		const rotated = game.rotateSelected();

		if (rotated) expect(game.playerFleet[game.selected].facing).not.toBe(before);
		expect(game.deploymentValid).toBe(true);
	});

	it('cycles the selection through the whole fleet', () => {
		const { game } = makeGame();
		const seen = new Set<number>();
		for (let i = 0; i < 5; i++) {
			seen.add(game.selected);
			game.selectNext();
		}
		expect(seen.size).toBe(5);
		expect(game.selected).toBe(0);
	});

	it('reshuffles into another legal fleet', () => {
		const { game } = makeGame();
		game.shuffleFleet();
		expect(game.deploymentValid).toBe(true);
		expect(game.playerBoard.ships).toHaveLength(5);
	});
});

describe('house rules', () => {
	it('calls a whole volley before answering any of it under SALVO', () => {
		const { game } = makeGame();
		game.setHouseRule('salvo', true);
		game.startBattle();
		expect(game.allowance).toBe(5);

		const cells = untriedCells(viewOf(game.cpuBoard)).slice(0, 5);
		for (const cell of cells.slice(0, 4)) {
			game.playerFire(cell);
			// Nothing is answered yet: the board is untouched.
			expect(untriedCells(viewOf(game.cpuBoard))).toHaveLength(100);
		}
		expect(game.pending).toHaveLength(4);

		game.playerFire(cells[4]);
		expect(game.pending).toHaveLength(0);
		expect(untriedCells(viewOf(game.cpuBoard))).toHaveLength(95);
	});

	it('lets a called cell be taken back before the volley resolves', () => {
		const { game } = makeGame();
		game.setHouseRule('salvo', true);
		game.startBattle();

		const cell = untriedCells(viewOf(game.cpuBoard))[0];
		game.playerFire(cell);
		expect(game.pending).toHaveLength(1);
		game.playerFire(cell);
		expect(game.pending).toHaveLength(0);
	});

	it('shrinks the salvo as the player loses ships', () => {
		const { game } = makeGame();
		game.setHouseRule('salvo', true);
		game.startBattle();

		for (const cell of cellsOf(game.playerBoard.ships[0])) {
			fireAt(game.playerBoard, cell);
		}
		expect(game.allowance).toBe(4);
	});

	it('keeps the turn on a hit under BONUS TURN', () => {
		const { game } = makeGame();
		game.setHouseRule('bonusTurn', true);
		game.startBattle();

		game.playerFire(cellsOf(game.cpuBoard.ships[0])[0]);
		expect(game.turn).toBe('player');

		const empty = untriedCells(viewOf(game.cpuBoard)).find((c) => !shipAt(game.cpuBoard, c))!;
		game.playerFire(empty);
		expect(game.turn).toBe('cpu');
	});

	it('withholds the sinking under SUNK SILENCE but still ends the game', () => {
		const { game } = makeGame();
		game.setHouseRule('sunkSilence', true);
		game.startBattle();

		for (const cell of cellsOf(game.cpuBoard.ships[0])) {
			game.playerFire(cell);
			vi.runAllTimers();
		}

		expect(game.cpuBoard.ships[0].hits.every(Boolean)).toBe(true);
		expect(sunkClasses(viewOf(game.cpuBoard)).size).toBe(0);
		expect(game.log.some((line) => line.text.includes('is down'))).toBe(false);
	});

	it('keeps ships apart under NO ADJACENCY', () => {
		const { game } = makeGame();
		game.setHouseRule('noAdjacency', true);
		expect(game.deploymentValid).toBe(true);

		const occupied = new Set(
			game.playerFleet.flatMap((ship) => cellsOf(ship).map((c) => `${c.row},${c.col}`))
		);
		for (const ship of game.playerFleet) {
			const own = new Set(cellsOf(ship).map((c) => `${c.row},${c.col}`));
			for (const cell of cellsOf(ship)) {
				for (let dr = -1; dr <= 1; dr++) {
					for (let dc = -1; dc <= 1; dc++) {
						const key = `${cell.row + dr},${cell.col + dc}`;
						if (!own.has(key)) expect(occupied.has(key)).toBe(false);
					}
				}
			}
		}
	});
});

describe('audio wiring', () => {
	it('drives the synth from the event stream', () => {
		const { game, ctx } = makeGame();
		game.startBattle();

		const before = ctx().nodes.length;
		game.playerFire({ row: 0, col: 0 });
		expect(ctx().nodes.length).toBeGreaterThan(before);
	});

	it('goes silent when muted, while the log keeps running', () => {
		const { game, ctx } = makeGame();
		game.startBattle();
		game.toggleMute();
		expect(game.muted).toBe(true);

		const before = ctx().nodes.length;
		const lines = game.log.length;
		game.playerFire({ row: 0, col: 0 });

		expect(ctx().nodes.length).toBe(before);
		expect(game.log.length).toBeGreaterThan(lines);
	});
});

describe('DELUXE edition', () => {
	it('switches to the 14-wide board and re-deploys both fleets', () => {
		const { game } = makeGame();
		game.reset('DELUXE');

		expect(game.size).toEqual({ rows: 10, cols: 14 });
		expect(untriedCells(viewOf(game.cpuBoard))).toHaveLength(140);
		expect(game.deploymentValid).toBe(true);
		expect(game.playerFleet).toHaveLength(5);
	});

	it('takes salvo from the official game type rather than the house toggle', () => {
		const { game } = makeGame();
		game.reset('DELUXE');
		expect(game.allowance).toBe(1);

		game.setGameType('SALVO');
		expect(game.allowance).toBe(5);
	});

	it('grants an extra turn on a hit under MULTI-ATTACK', () => {
		const { game } = makeGame();
		game.reset('DELUXE');
		game.setGameType('MULTI_ATTACK');
		game.startBattle();

		game.playerFire(cellsOf(game.cpuBoard.ships[0])[0]);
		expect(game.turn).toBe('player');
	});

	it('always names a sunk ship, even with SUNK SILENCE ticked', () => {
		const { game } = makeGame();
		game.reset('DELUXE');
		game.setHouseRule('sunkSilence', true);
		game.startBattle();

		for (const cell of cellsOf(game.cpuBoard.ships[4])) {
			game.playerFire(cell);
			vi.runAllTimers();
		}
		expect(sunkClasses(viewOf(game.cpuBoard)).size).toBe(1);
	});

	it('plays to a finish on the wider board', () => {
		const { game } = makeGame();
		game.reset('DELUXE');
		game.startBattle();

		for (const ship of game.cpuBoard.ships) {
			for (const cell of cellsOf(ship)) {
				if (game.phase !== 'battle') break;
				game.playerFire(cell);
				vi.runAllTimers();
			}
		}
		expect(game.phase).toBe('result');
		expect(game.winner).toBe('player');
	});
});

describe('advanced weapons', () => {
	it('moves the reticle to the cell that was clicked, so the preview matches', () => {
		const made = makeGame();
		made.game.reset('DELUXE');
		made.game.setWeapons('ADVANCED');
		made.game.startBattle();
		made.game.arm('BB_MISSILE');

		// The preview follows the reticle; firing elsewhere must bring it along.
		made.game.cursor = { row: 0, col: 0 };
		made.game.playerFire({ row: 5, col: 5 });
		expect(made.game.cursor).toEqual({ row: 5, col: 5 });
	});

	function deluxeAdvanced() {
		const made = makeGame();
		made.game.reset('DELUXE');
		made.game.setWeapons('ADVANCED');
		return made;
	}

	it('offers nothing on CLASSIC, which has no special weapons', () => {
		const { game } = makeGame();
		game.setWeapons('ADVANCED');
		expect(game.weaponsOnOffer).toHaveLength(0);
	});

	it('offers nothing under Basic weapons', () => {
		const { game } = makeGame();
		game.reset('DELUXE');
		expect(game.weaponsOnOffer).toHaveLength(0);
	});

	it('offers all four while the fleet is intact', () => {
		const { game } = deluxeAdvanced();
		expect(game.weaponsOnOffer.map((w) => w.id).sort()).toEqual([
			'BB_MISSILE',
			'DD_MISSILE',
			'DE_HOMING',
			'DE_SONAR'
		]);
	});

	it('spends the battleship missile and resolves nine cells', () => {
		const { game } = deluxeAdvanced();
		game.startBattle();
		game.cursor = { row: 5, col: 5 };
		game.arm('BB_MISSILE');
		expect(game.aimPreview).toHaveLength(9);

		game.playerFire({ row: 5, col: 5 });
		expect(game.roundsFor('BB_MISSILE')).toBe(0);
		expect(untriedCells(viewOf(game.cpuBoard))).toHaveLength(140 - 9);
		// Firing disarms, so the next click is an ordinary shot.
		expect(game.armed).toBeNull();
	});

	it('withdraws a weapon when its ship goes down', () => {
		const { game } = deluxeAdvanced();
		game.startBattle();
		expect(game.weaponsOnOffer.map((w) => w.id)).toContain('BB_MISSILE');

		const bb = game.playerBoard.ships.find((s) => s.class === 'BB')!;
		for (const cell of cellsOf(bb)) fireAt(game.playerBoard, cell);
		game.playerBoard = { ...game.playerBoard };

		expect(game.weaponsOnOffer.map((w) => w.id)).not.toContain('BB_MISSILE');
	});

	it('takes both escort weapons away together', () => {
		const { game } = deluxeAdvanced();
		const de = game.playerBoard.ships.find((s) => s.class === 'DE')!;
		for (const cell of cellsOf(de)) fireAt(game.playerBoard, cell);
		game.playerBoard = { ...game.playerBoard };

		const ids = game.weaponsOnOffer.map((w) => w.id);
		expect(ids).not.toContain('DE_HOMING');
		expect(ids).not.toContain('DE_SONAR');
	});

	it('never runs the sonar dry and never damages anything with it', () => {
		const { game } = deluxeAdvanced();
		game.startBattle();

		for (let i = 0; i < 4; i++) {
			game.arm('DE_SONAR');
			game.playerFire({ row: 5, col: 2 + i });
			vi.runAllTimers();
		}
		expect(game.roundsFor('DE_SONAR')).toBe(Infinity);
		expect(game.cpuBoard.ships.every((s) => !s.hits.some(Boolean))).toBe(true);
	});

	it('refuses a homing launch off the edge without spending a round', () => {
		const { game } = deluxeAdvanced();
		game.startBattle();
		game.arm('DE_HOMING');

		game.playerFire({ row: 5, col: 5 });
		expect(game.roundsFor('DE_HOMING')).toBe(2);
		expect(game.turn).toBe('player');
		expect(game.log.at(-1)?.text).toContain('grid edge');
	});

	it('flips the firing axis for the aim preview', () => {
		const { game } = deluxeAdvanced();
		game.startBattle();
		game.cursor = { row: 5, col: 5 };
		game.arm('DD_MISSILE');

		const horizontal = game.aimPreview;
		game.toggleOrientation();
		const vertical = game.aimPreview;

		expect(horizontal.every((c) => c.row === 5)).toBe(true);
		expect(vertical.every((c) => c.col === 5)).toBe(true);
	});

	it('lets ADMIRAL reach for a weapon of its own', () => {
		const { game } = deluxeAdvanced();
		game.difficulty = 3;
		game.startBattle();

		for (let turn = 0; turn < 25 && game.phase === 'battle'; turn++) {
			const cell = untriedCells(viewOf(game.cpuBoard))[0];
			game.playerFire(cell);
			vi.runAllTimers();
		}
		const spent = Object.values(game.cpuArsenal).reduce((a, b) => a + b, 0);
		expect(spent).toBeGreaterThan(0);
	});
});
