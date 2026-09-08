/**
 * A minimal stand-in for AudioContext so the synth can be exercised in Node.
 * Records the nodes it was asked to build, which is what the tests assert on.
 */
export interface RecordedNode {
	kind: string;
	started: number[];
	stopped: number[];
}

export class FakeAudioContext {
	currentTime = 0;
	sampleRate = 48000;
	state: AudioContextState = 'running';
	destination = { kind: 'destination' } as unknown as AudioDestinationNode;
	nodes: RecordedNode[] = [];
	resumed = 0;

	resume() {
		this.resumed++;
		return Promise.resolve();
	}

	#param() {
		return {
			value: 0,
			setValueAtTime: () => {},
			linearRampToValueAtTime: () => {},
			exponentialRampToValueAtTime: () => {}
		};
	}

	#record(kind: string) {
		const node: RecordedNode = { kind, started: [], stopped: [] };
		this.nodes.push(node);
		return node;
	}

	createGain() {
		this.#record('gain');
		return { gain: this.#param(), connect: () => {}, disconnect: () => {} } as never;
	}

	createOscillator() {
		const node = this.#record('oscillator');
		return {
			type: 'square',
			frequency: this.#param(),
			connect: () => {},
			start: (t: number) => node.started.push(t),
			stop: (t: number) => node.stopped.push(t)
		} as never;
	}

	createBufferSource() {
		const node = this.#record('bufferSource');
		return {
			buffer: null,
			connect: () => {},
			start: (t: number) => node.started.push(t),
			stop: (t: number) => node.stopped.push(t)
		} as never;
	}

	createBiquadFilter() {
		this.#record('biquad');
		return { type: 'lowpass', frequency: this.#param(), Q: { value: 1 }, connect: () => {} } as never;
	}

	createBuffer(_channels: number, frames: number) {
		this.#record('buffer');
		const data = new Float32Array(frames);
		return { getChannelData: () => data } as never;
	}

	count(kind: string) {
		return this.nodes.filter((n) => n.kind === kind).length;
	}
}
