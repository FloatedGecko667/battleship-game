import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from './game.svelte';
import { Synth } from '$lib/audio/synth';
import { FakeAudioContext } from '$lib/audio/fakeContext';
import { untriedCells, viewOf } from '$lib/engine/ai';
import { sunkClasses } from '$lib/engine/ai/view';
import { shipAt } from '$lib/engine/board';
import { fireAt } from '$lib/engine/resolve';
import { cellsOf } from '$lib/engine/geometry';
import { FORMATION_IDS } from '$lib/data/formations';

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

	it('offers the whole arsenal while the fleet is intact', () => {
		const { game } = deluxeAdvanced();
		expect(game.weaponsOnOffer.map((w) => w.id).sort()).toEqual([
			'ANTI_AIR',
			'BB_MISSILE',
			'CV_AIRCRAFT',
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

describe('carrier aircraft', () => {
	function deluxeAdvanced() {
		const made = makeGame();
		made.game.reset('DELUXE');
		made.game.setWeapons('ADVANCED');
		return made;
	}

	it('parks two planes on the carrier at deployment', () => {
		const { game } = deluxeAdvanced();
		expect(game.playerFlight).toHaveLength(2);
		expect(game.playerFlight.every((p) => p.at === null && p.armed && p.alive)).toBe(true);

		const carrier = game.playerBoard.ships.find((s) => s.class === 'CV')!;
		const deck = new Set(cellsOf(carrier).map((c) => `${c.row},${c.col}`));
		expect(game.playerFlight.every((p) => deck.has(`${p.home.row},${p.home.col}`))).toBe(true);
	});

	it('keeps the planes on the deck when the carrier is moved', () => {
		const { game } = deluxeAdvanced();
		game.selected = game.playerFleet.findIndex((s) => s.class === 'CV');
		game.rotateSelected();

		const carrier = game.playerBoard.ships.find((s) => s.class === 'CV')!;
		const deck = new Set(cellsOf(carrier).map((c) => `${c.row},${c.col}`));
		expect(game.playerFlight.every((p) => deck.has(`${p.home.row},${p.home.col}`))).toBe(true);
	});

	it('sweeps five cells and spends the strike only when it finds something', () => {
		const { game } = deluxeAdvanced();
		game.startBattle();
		game.arm('CV_AIRCRAFT');

		const carrier = game.cpuBoard.ships.find((s) => s.class === 'CV')!;
		const middle = cellsOf(carrier)[2];
		game.playerFire(middle);

		expect(game.playerFlight[0].at).toEqual(middle);
		expect(game.playerFlight[0].armed).toBe(false);
		expect(carrier.hits.some(Boolean)).toBe(true);
	});

	it('only searches once the strike is gone, doing no damage', () => {
		const { game } = deluxeAdvanced();
		game.startBattle();
		game.playerFlight[0].armed = false;
		game.playerFlight[0].at = { row: 0, col: 0 };

		const carrier = game.cpuBoard.ships.find((s) => s.class === 'CV')!;
		const before = carrier.hits.filter(Boolean).length;

		game.arm('CV_AIRCRAFT');
		game.playerFire(cellsOf(carrier)[2]);

		expect(carrier.hits.filter(Boolean).length).toBe(before);
		expect(game.log.at(-1)?.text).toContain('contact');
	});

	it('loses a plane still on deck when that cell is hit', () => {
		const { game } = deluxeAdvanced();
		game.difficulty = 1;
		game.startBattle();

		const doomed = game.cpuFlight[0];
		game.playerFire(doomed.home);

		expect(game.cpuFlight[0].alive).toBe(false);
		expect(game.log.some((l) => l.text.includes('aircraft destroyed on deck'))).toBe(true);
	});

	it('spares a plane that has already launched', () => {
		const { game } = deluxeAdvanced();
		game.startBattle();

		const plane = game.cpuFlight[0];
		plane.at = { row: 0, col: 0 };
		game.playerFire(plane.home);

		expect(game.cpuFlight[0].alive).toBe(true);
	});

	it('shoots down an enemy plane hovering over your own waters', () => {
		const { game } = deluxeAdvanced();
		game.startBattle();

		const spot = { row: 6, col: 6 };
		game.cpuFlight[0].at = spot;
		game.arm('ANTI_AIR');
		game.fireOwnWaters(spot);

		expect(game.cpuFlight[0].alive).toBe(false);
		expect(game.log.some((l) => l.text.includes('enemy aircraft down'))).toBe(true);
	});

	it('reports empty sky rather than pretending', () => {
		const { game } = deluxeAdvanced();
		game.startBattle();
		game.cpuFlight[0].at = { row: 6, col: 6 };

		game.arm('ANTI_AIR');
		game.fireOwnWaters({ row: 1, col: 1 });

		expect(game.cpuFlight.every((p) => p.alive)).toBe(true);
		expect(game.log.at(-1)?.text).toContain('nothing there');
	});

	it('withdraws both carrier weapons when the carrier sinks', () => {
		const { game } = deluxeAdvanced();
		const cv = game.playerBoard.ships.find((s) => s.class === 'CV')!;
		for (const cell of cellsOf(cv)) fireAt(game.playerBoard, cell);
		game.playerBoard = { ...game.playerBoard };

		const ids = game.weaponsOnOffer.map((w) => w.id);
		expect(ids).not.toContain('CV_AIRCRAFT');
		expect(ids).not.toContain('ANTI_AIR');
	});
})

describe('rulebook formations', () => {
	it('is offered on DELUXE only, since the diagrams are 14 files wide', () => {
		const { game } = makeGame();
		expect(game.presetsAvailable).toBe(false);
		expect(game.usePreset('A1')).toBe(false);

		game.reset('DELUXE');
		expect(game.presetsAvailable).toBe(true);
	});

	it('deploys A1 exactly as the rulebook draws it', () => {
		const { game } = makeGame();
		game.reset('DELUXE');
		expect(game.usePreset('A1')).toBe(true);

		const byClass = Object.fromEntries(game.playerFleet.map((s) => [s.class, s]));
		expect(byClass.CV).toMatchObject({ bow: { row: 6, col: 6 }, facing: 'W' });
		expect(byClass.PB).toMatchObject({ bow: { row: 6, col: 13 }, facing: 'N' });
		expect(game.deploymentValid).toBe(true);
	});

	it('brings the aircraft along, parked where the diagram shows them', () => {
		const { game } = makeGame();
		game.reset('DELUXE');
		game.usePreset('A1');

		expect(game.playerFlight).toHaveLength(2);
		expect(game.playerFlight.map((p) => `${p.home.row},${p.home.col}`).sort()).toEqual([
			'6,7',
			'6,9'
		]);
		expect(game.playerFlight.every((p) => p.at === null && p.armed)).toBe(true);
	});

	it('plays from every one of the hundred formations', () => {
		const { game } = makeGame();
		game.reset('DELUXE');

		for (const id of FORMATION_IDS) {
			expect(game.usePreset(id)).toBe(true);
			expect(game.deploymentValid).toBe(true);
			expect(game.playerBoard.ships).toHaveLength(5);
		}
	});

	it('stops calling it a formation once the fleet is edited', () => {
		const { game } = makeGame();
		game.reset('DELUXE');
		game.usePreset('A1');
		expect(game.presetId).toBe('A1');

		game.rotateSelected();
		expect(game.presetId).toBeNull();

		game.usePreset('B2');
		game.shuffleFleet();
		expect(game.presetId).toBeNull();
	});
})

describe('resuming an interrupted game', () => {
	it('restores the position, the damage and the log', () => {
		const { game } = makeGame();
		game.reset('DELUXE');
		game.startBattle();
		game.playerFire({ row: 3, col: 3 });
		vi.runAllTimers();
		game.playerFire({ row: 4, col: 4 });
		vi.runAllTimers();

		const snapshot = JSON.parse(JSON.stringify(game.snapshot()));
		const fresh = makeGame(999).game;
		fresh.restore(snapshot);

		expect(fresh.edition).toBe('DELUXE');
		expect(fresh.phase).toBe('battle');
		expect(fresh.cpuBoard.marks).toEqual(game.cpuBoard.marks);
		expect(fresh.playerBoard.ships).toEqual(game.playerBoard.ships);
		expect(fresh.log.map((l) => l.text)).toEqual(game.log.map((l) => l.text));
		expect(fresh.resumed).toBe(true);
	});

	it('keeps the rules and the spent ammunition', () => {
		const { game } = makeGame();
		game.reset('DELUXE');
		game.setWeapons('ADVANCED');
		game.setGameType('MULTI_ATTACK');
		game.startBattle();
		game.arm('BB_MISSILE');
		game.playerFire({ row: 5, col: 5 });

		const fresh = makeGame(999).game;
		fresh.restore(JSON.parse(JSON.stringify(game.snapshot())));

		expect(fresh.rules.weapons).toBe('ADVANCED');
		expect(fresh.rules.gameType).toBe('MULTI_ATTACK');
		expect(fresh.roundsFor('BB_MISSILE')).toBe(0);
	});

	it('does not stall when the save was taken on the CPU turn', () => {
		const { game } = makeGame();
		game.startBattle();
		game.playerFire({ row: 0, col: 0 });
		expect(game.turn).toBe('cpu');

		const fresh = makeGame(999).game;
		fresh.restore(JSON.parse(JSON.stringify(game.snapshot())));
		expect(fresh.turn).toBe('cpu');

		// Without a nudge on restore the game would sit here forever.
		vi.runAllTimers();
		expect(fresh.turn).toBe('player');
	});

	it('carries the flight across, wherever the planes were', () => {
		const { game } = makeGame();
		game.reset('DELUXE');
		game.setWeapons('ADVANCED');
		game.startBattle();
		game.arm('CV_AIRCRAFT');
		game.playerFire({ row: 6, col: 6 });

		const fresh = makeGame(999).game;
		fresh.restore(JSON.parse(JSON.stringify(game.snapshot())));

		expect(fresh.playerFlight[0].at).toEqual({ row: 6, col: 6 });
		expect(fresh.playerFlight[0].armed).toBe(game.playerFlight[0].armed);
	});

	it('starts clean again after New game', () => {
		const { game } = makeGame();
		game.startBattle();
		game.playerFire({ row: 0, col: 0 });

		game.reset();
		expect(game.phase).toBe('deploy');
		expect(game.resumed).toBe(false);
		expect(untriedCells(viewOf(game.cpuBoard))).toHaveLength(100);
	});
})

describe('Game.resume', () => {
	function withStorage() {
		const map = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => map.get(k) ?? null,
			setItem: (k: string, v: string) => void map.set(k, v),
			removeItem: (k: string) => void map.delete(k)
		});
		return map;
	}

	afterEach(() => vi.unstubAllGlobals());

	it('picks the saved game back up', () => {
		withStorage();
		const first = makeGame().game;
		first.startBattle();
		first.playerFire({ row: 2, col: 2 });
		vi.runAllTimers();

		// Constructing a Game clears the save, so resume() must read it first.
		const resumed = Game.resume(999, first.synthForTest);
		expect(resumed.phase).toBe('battle');
		expect(resumed.resumed).toBe(true);
		expect(resumed.cpuBoard.marks).toEqual(first.cpuBoard.marks);
	});

	it('leaves the save in place so a second reload still resumes', () => {
		withStorage();
		const first = makeGame().game;
		first.startBattle();
		first.playerFire({ row: 2, col: 2 });
		vi.runAllTimers();

		const once = Game.resume(999, first.synthForTest);
		const twice = Game.resume(998, first.synthForTest);
		expect(twice.resumed).toBe(true);
		expect(twice.cpuBoard.marks).toEqual(once.cpuBoard.marks);
	});

	it('starts fresh when nothing was saved', () => {
		withStorage();
		const game = Game.resume(7, makeGame().synth);
		expect(game.phase).toBe('deploy');
		expect(game.resumed).toBe(false);
	});

	it('starts fresh after New game clears the save', () => {
		withStorage();
		const first = makeGame().game;
		first.startBattle();
		first.playerFire({ row: 2, col: 2 });
		vi.runAllTimers();
		first.reset();

		expect(Game.resume(999, first.synthForTest).resumed).toBe(false);
	});
})
