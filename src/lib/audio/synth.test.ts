import { describe, expect, it, vi } from 'vitest';
import { Synth } from './synth';
import { FakeAudioContext } from './fakeContext';
import { play, soundFor, SOUNDS, type SoundId } from './sounds';
import { speak } from './speech';

function synthWith() {
	const contexts: FakeAudioContext[] = [];
	class Tracked extends FakeAudioContext {
		constructor() {
			super();
			contexts.push(this);
		}
	}
	const synth = new Synth(Tracked as unknown as new () => AudioContext);
	return { synth, contexts };
}

describe('Synth lifecycle', () => {
	it('does not build an AudioContext until unlocked', () => {
		const { synth, contexts } = synthWith();
		expect(synth.started).toBe(false);
		expect(contexts).toHaveLength(0);

		synth.unlock();
		expect(synth.started).toBe(true);
		expect(contexts).toHaveLength(1);
	});

	it('reuses the context and resumes it on a repeated unlock', () => {
		const { synth, contexts } = synthWith();
		synth.unlock();
		synth.unlock();
		expect(contexts).toHaveLength(1);
		expect(contexts[0].resumed).toBe(1);
	});

	it('reports unavailable rather than throwing when there is no Web Audio', () => {
		const synth = new Synth(undefined);
		// Node has no AudioContext, so this is the real headless path.
		expect(synth.available).toBe(false);
		expect(synth.unlock()).toBe(false);
		expect(() => synth.tone({ freq: 440, dur: 0.1 })).not.toThrow();
	});
});

describe('muting', () => {
	it('drops the master gain to zero and emits no nodes', () => {
		const { synth, contexts } = synthWith();
		synth.unlock();
		synth.setVolume(0.8);
		expect(synth.masterGain).toBe(0.8);

		synth.setMuted(true);
		expect(synth.masterGain).toBe(0);

		const before = contexts[0].count('oscillator');
		synth.tone({ freq: 440, dur: 0.1 });
		synth.noise({ dur: 0.1 });
		expect(contexts[0].count('oscillator')).toBe(before);
	});

	it('restores the chosen volume when unmuted', () => {
		const { synth } = synthWith();
		synth.unlock();
		synth.setVolume(0.4);
		synth.setMuted(true);
		synth.setMuted(false);
		expect(synth.masterGain).toBe(0.4);
	});

	it('clamps the volume to 0..1', () => {
		const { synth } = synthWith();
		synth.unlock();
		synth.setVolume(5);
		expect(synth.masterGain).toBe(1);
		synth.setVolume(-2);
		expect(synth.masterGain).toBe(0);
	});
});

describe('sound bank', () => {
	it('plays every sound without throwing once unlocked', () => {
		const { synth, contexts } = synthWith();
		synth.unlock();

		for (const id of Object.keys(SOUNDS) as SoundId[]) {
			expect(() => play(synth, id)).not.toThrow();
		}
		expect(contexts[0].nodes.length).toBeGreaterThan(0);
	});

	it('is silent before unlock instead of throwing', () => {
		const { synth } = synthWith();
		for (const id of Object.keys(SOUNDS) as SoundId[]) {
			expect(() => play(synth, id)).not.toThrow();
		}
		expect(synth.started).toBe(false);
	});
});

describe('soundFor', () => {
	it('separates hits from misses', () => {
		expect(soundFor({ type: 'shot', side: 'player', coord: { row: 0, col: 0 }, result: 'hit' })).toBe('hit');
		expect(soundFor({ type: 'shot', side: 'player', coord: { row: 0, col: 0 }, result: 'miss' })).toBe('miss');
	});

	it('answers a sonar contact differently from clear water', () => {
		const coord = { row: 1, col: 1 };
		expect(soundFor({ type: 'scan', side: 'player', coord, detected: true })).toBe('sonarContact');
		expect(soundFor({ type: 'scan', side: 'player', coord, detected: false })).toBe('sonar');
	});

	it('plays victory or defeat depending on the viewer', () => {
		expect(soundFor({ type: 'victory', side: 'player' })).toBe('victory');
		expect(soundFor({ type: 'victory', side: 'cpu' })).toBe('defeat');
	});
});

describe('speech', () => {
	it('does nothing when disabled', () => {
		expect(speak('anything', false)).toBe(false);
	});

	it('falls back silently when the platform has no speech engine', () => {
		// Node has neither speechSynthesis nor the utterance constructor.
		expect(() => speak('enemy hit', true)).not.toThrow();
		expect(speak('enemy hit', true)).toBe(false);
	});

	it('uses the platform voice when one exists', () => {
		const spoken: string[] = [];
		vi.stubGlobal('speechSynthesis', { speak: (u: { text: string }) => spoken.push(u.text) });
		vi.stubGlobal(
			'SpeechSynthesisUtterance',
			class {
				rate = 1;
				constructor(public text: string) {}
			}
		);

		expect(speak('enemy hit', true)).toBe(true);
		expect(spoken).toEqual(['enemy hit']);
		vi.unstubAllGlobals();
	});
});
