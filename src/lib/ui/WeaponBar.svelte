<script lang="ts">
	import type { WeaponId, WeaponSpec } from '$lib/engine/weapons/index';
	import type { Orientation } from '$lib/engine/weapons/patterns';
	import type { Aircraft } from '$lib/engine/weapons/aircraft';
	import Panel from './Panel.svelte';

	interface Props {
		weapons: WeaponSpec[];
		armed: WeaponId | null;
		orientation: Orientation;
		rounds: (id: WeaponId) => number;
		onArm: (id: WeaponId) => void;
		onOrientation: () => void;
		flight: Aircraft[];
		activePlane: number;
		onSelectPlane: (index: number) => void;
		/** Why the list is empty, so the panel can say what to do about it. */
		reason: 'edition' | 'basic' | 'ships' | null;
		/** Weapons can be armed only once the shooting starts. */
		inBattle: boolean;
	}

	let {
		weapons,
		armed,
		orientation,
		rounds,
		onArm,
		onOrientation,
		flight,
		activePlane,
		onSelectPlane,
		reason,
		inBattle
	}: Props = $props();

	const armedSpec = $derived(weapons.find((w) => w.id === armed) ?? null);
	const needsAxis = $derived(armedSpec?.aim === 'line' || armedSpec?.aim === 'edge');
	const needsPattern = $derived(armedSpec?.aim === 'sweep');
</script>

<Panel title="Weapons">
	{#if weapons.length === 0}
		<!-- Say where to go, not just that there is nothing here. -->
		{#if reason === 'edition'}
			<p class="none">
				Special weapons belong to the Deluxe game.
				<strong>Set Edition to DELUXE</strong> at the top of the page.
			</p>
		{:else if reason === 'basic'}
			<p class="none">
				This mission is running Basic weapons.
				<strong>Choose Advanced</strong> under Weapons in the Mission panel, before the
				battle starts.
			</p>
		{:else}
			<p class="none">
				Every ship that carried a special weapon has been sunk. Nothing left to fire.
			</p>
		{/if}
	{:else}
		<ul>
			{#each weapons as weapon, index (weapon.id)}
				<li>
					<button
						type="button"
						class:armed={armed === weapon.id}
						disabled={!inBattle}
						onclick={() => onArm(weapon.id)}
					>
						<!-- The number key that arms it, so the binding is visible. -->
						<span class="key">{index + 1}</span>
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

		{#if needsPattern && flight.length}
			<ul class="flight">
				{#each flight as plane, index (plane.id)}
					<li>
						<button
							type="button"
							class:armed={activePlane === index}
							onclick={() => onSelectPlane(index)}
						>
							<span class="ship">◆{plane.id + 1}</span>
							<span class="name">{plane.at ? 'aloft' : 'on deck'}</span>
							<span class="rounds">{plane.armed ? 'strike' : 'search'}</span>
						</button>
					</li>
				{/each}
			</ul>
			<button type="button" class="axis" onclick={onOrientation}>
				Pattern: {orientation === 'H' ? '+' : '✕'} — press P to switch
			</button>
		{/if}
		{#if !inBattle}
			<p class="guidance">Ready to arm once the battle starts.</p>
		{:else if armedSpec}
			<p class="guidance armed-hint">
				{#if armedSpec.ownWaters}
					Click <strong>your own board</strong> where you think an enemy plane is overhead.
				{:else if armedSpec.aim === 'edge'}
					Click a cell on the <strong>edge</strong> of the enemy board to launch from.
				{:else if armedSpec.aim === 'sweep'}
					Click the <strong>enemy board</strong> where the plane should search.
				{:else}
					Click the <strong>enemy board</strong> at the centre of the strike.
				{/if}
				<span class="dim">Esc stands down.</span>
			</p>
		{:else}
			<p class="guidance">Press <kbd>1</kbd>–<kbd>{weapons.length}</kbd>, or pick one above.</p>
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

	.key {
		width: 1ch;
		color: var(--text-dim);
		font-size: 0.62rem;
	}

	button.armed .key {
		color: var(--enemy);
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

	.flight {
		margin-top: 0.4rem;
	}

	.axis {
		margin-top: 0.4rem;
		border-color: var(--ally-dim);
		color: var(--ally);
		justify-content: center;
	}

	.guidance,
	.none {
		margin: 0.4rem 0 0;
		font-size: 0.64rem;
		color: var(--text-dim);
		line-height: 1.5;
	}

	.none strong {
		color: var(--ally);
	}

	.armed-hint {
		color: var(--text);
	}

	.armed-hint strong {
		color: var(--enemy);
	}

	.dim {
		color: var(--text-dim);
	}

	kbd {
		border: 1px solid var(--rule-faint);
		padding: 0 0.25rem;
		font: inherit;
		font-size: 0.62rem;
		color: var(--text);
	}
</style>
