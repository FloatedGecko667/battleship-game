<script lang="ts">
	import type { WeaponId, WeaponSpec } from '$lib/engine/weapons/index';
	import type { Orientation } from '$lib/engine/weapons/patterns';
	import Panel from './Panel.svelte';

	interface Props {
		weapons: WeaponSpec[];
		armed: WeaponId | null;
		orientation: Orientation;
		rounds: (id: WeaponId) => number;
		onArm: (id: WeaponId) => void;
		onOrientation: () => void;
	}

	let { weapons, armed, orientation, rounds, onArm, onOrientation }: Props = $props();

	const armedSpec = $derived(weapons.find((w) => w.id === armed) ?? null);
	const needsAxis = $derived(armedSpec?.aim === 'line' || armedSpec?.aim === 'edge');
</script>

<Panel title="Weapons">
	{#if weapons.length === 0}
		<p class="none">No special weapons. Their ships are gone, or the mission is Basic.</p>
	{:else}
		<ul>
			{#each weapons as weapon (weapon.id)}
				<li>
					<button type="button" class:armed={armed === weapon.id} onclick={() => onArm(weapon.id)}>
						<span class="ship">{weapon.ship}</span>
						<span class="name">{weapon.name}</span>
						<span class="rounds">{rounds(weapon.id) === Infinity ? '∞' : rounds(weapon.id)}</span>
					</button>
					<span class="blurb">{weapon.blurb}</span>
				</li>
			{/each}
		</ul>

		{#if needsAxis}
			<button type="button" class="axis" onclick={onOrientation}>
				Axis: {orientation === 'H' ? 'Horizontal' : 'Vertical'} — press P to switch
			</button>
		{/if}
		{#if armedSpec}
			<p class="hint">
				{armedSpec.aim === 'edge'
					? 'Pick a launch cell on the grid edge.'
					: 'Pick the centre of the strike.'}
			</p>
		{/if}
	{/if}
</Panel>

<style>
	ul {
		display: grid;
		gap: 0.3rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		border: 1px solid var(--rule-faint);
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: 0.72rem;
		padding: 0.2rem 0.4rem;
		cursor: pointer;
		text-align: left;
	}

	button.armed {
		border-color: var(--enemy);
		color: var(--enemy);
		box-shadow: 0 0 8px var(--enemy-glow);
	}

	.ship {
		font-weight: 700;
		color: var(--code);
		width: 2ch;
	}

	button.armed .ship {
		color: var(--enemy);
	}

	.name {
		flex: 1;
	}

	.rounds {
		font-variant-numeric: tabular-nums;
		color: var(--text-dim);
	}

	.blurb {
		display: block;
		padding: 0.1rem 0 0.25rem 0.4rem;
		font-size: 0.62rem;
		color: var(--text-dim);
	}

	.axis {
		margin-top: 0.4rem;
		border-color: var(--ally-dim);
		color: var(--ally);
		justify-content: center;
	}

	.hint,
	.none {
		margin: 0.4rem 0 0;
		font-size: 0.64rem;
		color: var(--text-dim);
	}
</style>
