<script>
	import { createEventDispatcher } from "svelte";

	const dispatch = createEventDispatcher();

	const templateWidgets = [
		{
			id: "toolbar-template-widget",
			type: "chart",
			title: "Toolbar Template",
			layout: { x: 0, y: 0, w: 6, h: 4 },
			config: {},
		},
	];
</script>

<button class="widget-toolbar-mock-apply" on:click={() => dispatch("applyTemplate", templateWidgets)}>
	Apply Mock Template
</button>