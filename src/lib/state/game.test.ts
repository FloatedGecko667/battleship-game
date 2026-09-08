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
