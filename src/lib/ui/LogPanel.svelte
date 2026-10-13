<script lang="ts" module>
	import type { LogMsg } from '$lib/i18n/index.svelte';

	export interface LogLine {
		id: number;
		side: 'player' | 'cpu' | 'system';
		/** Stored as data so the whole log re-reads in the current language. */
		msg: LogMsg;
	}
</script>

<script lang="ts">
	import Panel from './Panel.svelte';
	import { i18n, logText } from '$lib/i18n/index.svelte';

	interface Props {
		lines: LogLine[];
	}

	let { lines }: Props = $props();
	let scroller: HTMLDivElement | undefined = $state();

	$effect(() => {
		// Touch `lines` so the effect reruns, then pin the view to the newest entry.
		lines.length;
		if (scroller) scroller.scrollTop = scroller.scrollHeight;
	});
</script>

<Panel title={i18n.t.log.title}>
	<div class="scroll" bind:this={scroller} role="log" aria-live="polite" aria-relevant="additions">
		{#each lines as line (line.id)}
			<p class="line" data-side={line.side}>
				<span class="marker">{line.side === 'player' ? '>' : line.side === 'cpu' ? '<' : '#'}</span>
				{logText(i18n.t, line.msg)}
			</p>
		{/each}
	</div>
</Panel>

<style>
	.scroll {
		height: 9rem;
		overflow-y: auto;
		font-size: 0.7rem;
		line-height: 1.5;
	}

	.line {
		margin: 0;
		white-space: pre-wrap;
	}

	.marker {
		display: inline-block;
		width: 1ch;
		margin-right: 0.5ch;
	}

	.line[data-side='player'] .marker {
		color: var(--ally);
	}

	.line[data-side='cpu'] .marker {
		color: var(--enemy);
	}

	.line[data-side='system'] {
		color: var(--text-dim);
	}
</style>
