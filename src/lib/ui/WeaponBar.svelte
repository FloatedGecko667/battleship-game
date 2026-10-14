<script lang="ts">
	import type { WeaponId, WeaponSpec } from '$lib/engine/weapons/index';
	import type { Orientation } from '$lib/engine/weapons/patterns';
	import type { Aircraft } from '$lib/engine/weapons/aircraft';
	import Panel from './Panel.svelte';
	import { i18n } from '$lib/i18n/index.svelte';

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

	const t = $derived(i18n.t.weapons);
	const armedSpec = $derived(weapons.find((w) => w.id === armed) ?? null);
	const needsAxis = $derived(armedSpec?.aim === 'line' || armedSpec?.aim === 'edge');
	const needsPattern = $derived(armedSpec?.aim === 'sweep');
</script>

<Panel title={t.title}>
	{#if weapons.length === 0}
		<!-- Say where to go, not just that there is nothing here. -->
		{#if reason === 'edition'}
			<p class="none">{t.noneEdition.pre}<strong>{t.noneEdition.em}</strong>{t.noneEdition.post}</p>
		{:else if reason === 'basic'}
			<p class="none">{t.noneBasic.pre}<strong>{t.noneBasic.em}</strong>{t.noneBasic.post}</p>
		{:else}
			<p class="none">{t.noneShips}</p>
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
						<span class="name">{t.names[weapon.id]}</span>
						<span class="rounds">{rounds(weapon.id) === Infinity ? '∞' : rounds(weapon.id)}</span>
					</button>
					<span class="blurb">{t.blurbs[weapon.id]}</span>
				</li>
			{/each}
		</ul>

		{#if needsAxis}
			<button type="button" class="axis" onclick={onOrientation}>
				{t.axis(orientation === 'H')}
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
							<span class="name">{plane.at ? t.aloft : t.onDeck}</span>
							<span class="rounds">{plane.armed ? t.strike : t.search}</span>
						</button>
					</li>
				{/each}
			</ul>
			<button type="button" class="axis" onclick={onOrientation}>
				{t.pattern(orientation === 'H')}
			</button>
		{/if}
		{#if !inBattle}
			<p class="guidance">{t.notYet}</p>
		{:else if armedSpec}
			{@const aim = armedSpec.ownWaters
				? t.aimOwn
				: armedSpec.aim === 'edge'
					? t.aimEdge
					: armedSpec.aim === 'sweep'
						? t.aimSweep
						: t.aimCentre}
			<p class="guidance armed-hint">
				{aim.pre}<strong>{aim.em}</strong>{aim.post}
				<span class="dim">{t.escStandsDown}</span>
			</p>
		{:else}
			<p class="guidance">
				{t.pickPre} <kbd>1</kbd>–<kbd>{weapons.length}</kbd>{t.pickPost}
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
		font-size: 0.75rem;
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
		font-size: 0.75rem;
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
		font-size: 0.75rem;
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
		font-size: 0.75rem;
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
		font-size: 0.75rem;
		color: var(--text);
	}
</style>
