import type { GameEvent } from '$lib/engine/resolve';
import type { Synth } from './synth';

/**
 * Stands in for the electronic unit's voice, buzzers and chimes. Each entry is
 * built from the two synth primitives only.
 */
export type SoundId =
	| 'boot'
	| 'cursor'
	| 'turnStart'
	| 'fire'
	| 'hit'
	| 'miss'
	| 'sonar'
	| 'sonarContact'
	| 'sunk'
	| 'launch'
	| 'shootdown'
	| 'invalid'
	| 'victory'
	| 'defeat';

export const SOUNDS: Record<SoundId, (synth: Synth) => void> = {
	boot: (s) => {
		s.tone({ freq: 220, sweepTo: 880, dur: 0.5, type: 'sawtooth', gain: 0.16 });
		s.noise({ dur: 0.45, filter: { type: 'lowpass', freq: 400 }, sweepTo: 3000, gain: 0.1 });
	},

	cursor: (s) => s.tone({ freq: 880, dur: 0.02, gain: 0.06 }),

	turnStart: (s) => {
		s.tone({ freq: 660, dur: 0.04, gain: 0.12 });
		s.tone({ freq: 880, dur: 0.04, gain: 0.12, at: 0.06 });
	},

	// Launch: a noise burst swept from bright to dark.
	fire: (s) =>
		s.noise({ dur: 0.22, filter: { type: 'bandpass', freq: 3000, q: 1.2 }, sweepTo: 300, gain: 0.2 }),

	hit: (s) => {
		s.noise({ dur: 0.4, filter: { type: 'lowpass', freq: 900 }, sweepTo: 120, gain: 0.32 });
		s.tone({ freq: 160, sweepTo: 40, dur: 0.35, type: 'sine', gain: 0.3 });
	},

	miss: (s) => {
		s.noise({ dur: 0.18, filter: { type: 'bandpass', freq: 1200, q: 0.8 }, gain: 0.14 });
		s.tone({ freq: 110, dur: 0.12, gain: 0.16, at: 0.05 });
	},

	sonar: (s) => s.tone({ freq: 1200, dur: 0.55, type: 'sine', gain: 0.18 }),

	// A contact answers with a second return ping.
	sonarContact: (s) => {
		s.tone({ freq: 1200, dur: 0.55, type: 'sine', gain: 0.18 });
		s.tone({ freq: 900, dur: 0.5, type: 'sine', gain: 0.16, at: 0.3 });
	},

	sunk: (s) => {
		s.tone({ freq: 400, sweepTo: 60, dur: 0.8, type: 'sawtooth', gain: 0.22 });
		s.noise({ dur: 0.9, filter: { type: 'lowpass', freq: 600 }, sweepTo: 80, gain: 0.18 });
	},

	launch: (s) => s.tone({ freq: 200, sweepTo: 1400, dur: 0.35, type: 'triangle', gain: 0.18 }),

	shootdown: (s) => {
		s.tone({ freq: 500, sweepTo: 1500, dur: 0.1, type: 'square', gain: 0.16 });
		s.tone({ freq: 1500, sweepTo: 90, dur: 0.3, type: 'square', gain: 0.16, at: 0.1 });
	},

	invalid: (s) => {
		s.tone({ freq: 150, dur: 0.07, gain: 0.14 });
		s.tone({ freq: 150, dur: 0.07, gain: 0.14, at: 0.11 });
	},

	victory: (s) => {
		[523, 659, 784, 1046].forEach((freq, i) =>
			s.tone({ freq, dur: 0.16, type: 'triangle', gain: 0.18, at: i * 0.12 })
		);
	},

	defeat: (s) => {
		[523, 415, 349, 262].forEach((freq, i) =>
			s.tone({ freq, dur: 0.22, type: 'sawtooth', gain: 0.16, at: i * 0.16 })
		);
	}
};

/** Maps one game event onto the sound it should make, or null for silence. */
export function soundFor(event: GameEvent, viewer: 'player' | 'cpu' = 'player'): SoundId | null {
	switch (event.type) {
		case 'shot':
			return event.result === 'hit' ? 'hit' : 'miss';
		case 'sunk':
			return 'sunk';
		case 'scan':
			return event.detected ? 'sonarContact' : 'sonar';
		case 'repeat':
			return 'invalid';
		case 'extraTurn':
			return 'turnStart';
		case 'victory':
			return event.side === viewer ? 'victory' : 'defeat';
	}
}

export function play(synth: Synth, id: SoundId) {
	SOUNDS[id](synth);
}
