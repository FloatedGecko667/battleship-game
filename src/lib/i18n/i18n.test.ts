import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ja } from './ja';
import { detectLocale, logText, type LogMsg } from './index.svelte';

/** Every leaf path, with functions and arrays counted as leaves. */
function paths(value: unknown, prefix = ''): string[] {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return Object.entries(value).flatMap(([k, v]) => paths(v, `${prefix}${k}.`));
	}
	return [prefix.slice(0, -1)];
}

const memoryStore = (initial?: string) => {
	const data = new Map<string, string>(initial ? [['firingsolution.locale', initial]] : []);
	return {
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v)
	};
};

describe('dictionaries', () => {
	it('define the same keys in both languages', () => {
		expect(paths(ja).sort()).toEqual(paths(en).sort());
	});

	it('leave no string empty except deliberate fragments', () => {
		const blank = paths(ja).filter((p) => {
			const v = p.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], ja);
			return v === '' && !/\.(pre|post)$/.test(p);
		});
		expect(blank).toEqual([]);
	});

	it('name every ship class in both languages', () => {
		for (const cls of ['CV', 'BB', 'CA', 'SS', 'DD2', 'DD', 'DE', 'PB'] as const) {
			expect(en.ships[cls]).toBeTruthy();
			expect(ja.ships[cls]).toBeTruthy();
		}
	});
});

describe('detectLocale', () => {
	it('prefers a saved choice over the browser language', () => {
		expect(detectLocale(memoryStore('en'), ['ja-JP'])).toBe('en');
	});

	it('follows the browser language when nothing is saved', () => {
		expect(detectLocale(memoryStore(), ['ja-JP', 'en-US'])).toBe('ja');
		expect(detectLocale(memoryStore(), ['fr-FR', 'ja'])).toBe('ja');
	});

	it('falls back to English', () => {
		expect(detectLocale(memoryStore(), ['fr-FR'])).toBe('en');
		expect(detectLocale(null, [])).toBe('en');
	});

	it('survives storage that throws', () => {
		const hostile = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {}
		};
		expect(detectLocale(hostile, ['ja'])).toBe('ja');
	});

	it('ignores a saved value it does not know', () => {
		expect(detectLocale(memoryStore('xx'), ['ja'])).toBe('ja');
	});
});

describe('logText', () => {
	const shot: LogMsg = { k: 'shot', side: 'player', at: { row: 1, col: 4 }, hit: true };

	it('words the same entry in each language', () => {
		expect(logText(en, shot)).toBe('Salvo B5 — HIT');
		expect(logText(ja, shot)).toBe('砲撃 B5 — 命中');
	});

	it('names a sunk ship by its hull code', () => {
		const sunk: LogMsg = { k: 'sunk', side: 'cpu', cls: 'DD2' };
		expect(logText(en, sunk)).toBe('Enemy Destroyer is down (DD)');
		expect(logText(ja, sunk)).toContain('（DD）');
	});

	it('produces text for every message kind', () => {
		const at = { row: 0, col: 0 };
		const all: LogMsg[] = [
			shot,
			{ k: 'sunk', side: 'player', cls: 'SS' },
			{ k: 'scan', at, detected: false },
			{ k: 'repeat', at },
			{ k: 'extraTurn' },
			{ k: 'victory', winner: 'cpu' },
			{ k: 'deploy' },
			{ k: 'onStation' },
			{ k: 'underWay', cls: 'CA', ahead: false },
			{ k: 'cpuUnderWay' },
			{ k: 'antiAir', at, downed: true },
			{ k: 'notEdge' },
			{ k: 'noAircraft' },
			{ k: 'deckLoss', count: 2 }
		];
		for (const msg of all) {
			expect(logText(en, msg).length).toBeGreaterThan(0);
			expect(logText(ja, msg).length).toBeGreaterThan(0);
		}
	});
});
