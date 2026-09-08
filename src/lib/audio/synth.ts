/**
 * Every sound in the game is synthesised here. No audio files exist, which
 * keeps the offline bundle small and suits the terminal aesthetic.
 */

export type AudioContextCtor = new () => AudioContext;

export interface ToneSpec {
	freq: number;
	type?: OscillatorType;
	/** Seconds. */
	dur: number;
	/** Glide to this frequency across the tone. */
	sweepTo?: number;
	gain?: number;
	/** Delay before the tone starts, in seconds. */
	at?: number;
}

export interface NoiseSpec {
	dur: number;
	filter?: { type: BiquadFilterType; freq: number; q?: number };
	/** Glide the filter cutoff across the burst. */
	sweepTo?: number;
	gain?: number;
	at?: number;
}

const STORAGE_KEY = 'salvonet.audio';

function resolveCtor(explicit?: AudioContextCtor): AudioContextCtor | null {
	if (explicit) return explicit;
	if (typeof globalThis === 'undefined') return null;
	const g = globalThis as unknown as {
		AudioContext?: AudioContextCtor;
		webkitAudioContext?: AudioContextCtor;
	};
	return g.AudioContext ?? g.webkitAudioContext ?? null;
}

export class Synth {
	#ctor: AudioContextCtor | null;
	#ctx: AudioContext | null = null;
	#master: GainNode | null = null;
	#noiseBuffer: AudioBuffer | null = null;

	muted = false;
	volume = 0.55;

	/**
	 * The context is NOT created here: browsers refuse to start one outside a
	 * user gesture, and constructing it at import time would leave it suspended.
	 */
	constructor(ctor?: AudioContextCtor) {
		this.#ctor = resolveCtor(ctor);
		this.#restore();
	}

	get available(): boolean {
		return this.#ctor !== null;
	}

	get started(): boolean {
		return this.#ctx !== null;
	}

	/** Call from the first user gesture. Safe to call repeatedly. */
	unlock(): boolean {
		if (this.#ctx) {
			void this.#ctx.resume?.();
			return true;
		}
		if (!this.#ctor) return false;

		this.#ctx = new this.#ctor();
		this.#master = this.#ctx.createGain();
		this.#master.gain.value = this.#targetGain();
		this.#master.connect(this.#ctx.destination);
		return true;
	}

	setMuted(muted: boolean) {
		this.muted = muted;
		if (this.#master) this.#master.gain.value = this.#targetGain();
		this.#persist();
	}

	setVolume(volume: number) {
		this.volume = Math.min(1, Math.max(0, volume));
		if (this.#master) this.#master.gain.value = this.#targetGain();
		this.#persist();
	}

	/** Read back for tests and for the volume control. */
	get masterGain(): number | null {
		return this.#master ? this.#master.gain.value : null;
	}

	tone(spec: ToneSpec) {
		const ctx = this.#ctx;
		const master = this.#master;
		if (!ctx || !master || this.muted) return;

		const start = ctx.currentTime + (spec.at ?? 0);
		const osc = ctx.createOscillator();
		osc.type = spec.type ?? 'square';
		osc.frequency.setValueAtTime(spec.freq, start);
		if (spec.sweepTo !== undefined) {
			osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.sweepTo), start + spec.dur);
		}

		const env = ctx.createGain();
		this.#envelope(env, start, spec.dur, spec.gain ?? 0.3);

		osc.connect(env);
		env.connect(master);
		osc.start(start);
		osc.stop(start + spec.dur + 0.02);
	}

	noise(spec: NoiseSpec) {
		const ctx = this.#ctx;
		const master = this.#master;
		if (!ctx || !master || this.muted) return;

		const start = ctx.currentTime + (spec.at ?? 0);
		const source = ctx.createBufferSource();
		source.buffer = this.#whiteNoise(ctx);

		const env = ctx.createGain();
		this.#envelope(env, start, spec.dur, spec.gain ?? 0.25);

		let tail: AudioNode = source;
		if (spec.filter) {
			const filter = ctx.createBiquadFilter();
			filter.type = spec.filter.type;
			filter.frequency.setValueAtTime(spec.filter.freq, start);
			if (spec.sweepTo !== undefined) {
				filter.frequency.exponentialRampToValueAtTime(
					Math.max(1, spec.sweepTo),
					start + spec.dur
				);
			}
			if (spec.filter.q !== undefined) filter.Q.value = spec.filter.q;
			source.connect(filter);
			tail = filter;
		}

		tail.connect(env);
		env.connect(master);
		source.start(start);
		source.stop(start + spec.dur + 0.02);
	}

	#envelope(env: GainNode, start: number, dur: number, peak: number) {
		const attack = Math.min(0.008, dur / 4);
		env.gain.setValueAtTime(0.0001, start);
		env.gain.linearRampToValueAtTime(peak, start + attack);
		env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
	}

	#whiteNoise(ctx: AudioContext): AudioBuffer {
		if (this.#noiseBuffer) return this.#noiseBuffer;
		const frames = Math.floor(ctx.sampleRate * 0.5);
		const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
		this.#noiseBuffer = buffer;
		return buffer;
	}

	#targetGain(): number {
		return this.muted ? 0 : this.volume;
	}

	#persist() {
		try {
			globalThis.localStorage?.setItem(
				STORAGE_KEY,
				JSON.stringify({ muted: this.muted, volume: this.volume })
			);
		} catch {
			// Private browsing and blocked site data both land here; audio settings
			// are a convenience, so losing them is fine.
		}
	}

	#restore() {
		try {
			const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
			if (!raw) return;
			const saved = JSON.parse(raw) as { muted?: boolean; volume?: number };
			if (typeof saved.muted === 'boolean') this.muted = saved.muted;
			if (typeof saved.volume === 'number') this.volume = Math.min(1, Math.max(0, saved.volume));
		} catch {
			// Ignore corrupt or unreadable settings.
		}
	}
}
