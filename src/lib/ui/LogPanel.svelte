<script lang="ts">
	import Panel from './Panel.svelte';

	export interface LogLine {
		id: number;
		side: 'player' | 'cpu' | 'system';
		text: string;
	}

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

<Panel title="Log">
	<div class="scroll" bind:this={scroller} role="log" aria-live="polite" aria-relevant="additions">
		{#each lines as line (line.id)}
			<p class="line" data-side={line.side}>
				<span class="marker">{line.side === 'player' ? '>' : line.side === 'cpu' ? '<' : '#'}</span>
				{line.text}
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
