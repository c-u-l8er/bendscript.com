<script>
	export let placeholder = "Type a prompt into graph space…";
	export let maxLength = 220;
</script>

<div class="composer" id="composer">
	<form class="composer-inner" id="composerForm" autocomplete="off">
		<input id="promptInput" {placeholder} maxlength={maxLength} />
		<button class="send-btn" type="submit">Bend ↴</button>
	</form>
	<div class="composer-sub">
		<button
			class="composer-grip"
			id="composerDragHandle"
			type="button"
			title="Drag prompt composer"
		>
			Drag prompt
		</button>
		<div class="target" id="composerTarget">target: BendScript</div>
		<div>Enter to spawn node + response</div>
	</div>
</div>
