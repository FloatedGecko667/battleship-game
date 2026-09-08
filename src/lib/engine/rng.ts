/** Seeded PRNG so games, shuffles and AI runs are reproducible in tests. */
export interface Rng {
	/** Float in [0, 1). */
	next(): number;
	/** Integer in [0, max). */
	int(max: number): number;
	/** Fisher-Yates, in place. */
	shuffle<T>(items: T[]): T[];
}

export function mulberry32(seed: number): Rng {
	let state = seed >>> 0;

	const next = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	const int = (max: number) => Math.floor(next() * max);

	return {
		next,
		int,
		shuffle<T>(items: T[]): T[] {
			for (let i = items.length - 1; i > 0; i--) {
				const j = int(i + 1);
				[items[i], items[j]] = [items[j], items[i]];
			}
			return items;
		}
	};
}
