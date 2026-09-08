<script lang="ts">
	import {
		HOUSE_RULE_BLURB,
		HOUSE_RULE_NAME,
		type HouseRules
	} from '$lib/engine/ruleset';
	import Panel from './Panel.svelte';

	interface Props {
		house: HouseRules;
		/** Rules may only change before the first shot. */
		locked: boolean;
		onToggle: (key: keyof HouseRules, value: boolean) => void;
	}

	let { house, locked, onToggle }: Props = $props();

	const keys = Object.keys(HOUSE_RULE_NAME) as (keyof HouseRules)[];
</script>

<Panel title="House Rules">
	<ul>
		{#each keys as key (key)}
			<li>
				<label>
					<input
						type="checkbox"
						checked={house[key]}
						disabled={locked}
						onchange={(e) => onToggle(key, e.currentTarget.checked)}
					/>
					<span class="name">{HOUSE_RULE_NAME[key]}</span>
				</label>
				<span class="blurb">{HOUSE_RULE_BLURB[key]}</span>
			</li>
		{/each}
	</ul>
	{#if locked}
		<p class="locked">Locked once the battle starts.</p>
	{/if}
</Panel>

<style>
	ul {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		font-size: 0.72rem;
	}

	input:disabled + .name {
		color: var(--text-dim);
	}

	input {
		accent-color: var(--ally);
		cursor: pointer;
	}

	.name {
		letter-spacing: 0.06em;
	}

	.blurb {
		display: block;
		padding-left: 1.35rem;
		font-size: 0.64rem;
		color: var(--text-dim);
	}

	.locked {
		margin: 0.5rem 0 0;
		font-size: 0.64rem;
		color: var(--text-dim);
	}
</style>
