<aside class="edge-inspector" id="edgeInspector">
	<h3>EDGE INSPECTOR</h3>
	<p class="inspector-sub">
		Select an edge to edit metadata/props for relationship semantics.
	</p>

	<div class="field">
		<label for="edgePropLabel">Label</label>
		<input
			id="edgePropLabel"
			type="text"
			maxlength="80"
			placeholder="e.g. causes, references, expands"
		/>
	</div>

	<div class="field">
		<label for="edgePropKind">Kind</label>
		<select id="edgePropKind">
			<option value="context">Context</option>
			<option value="causal">Causal</option>
			<option value="temporal">Temporal</option>
			<option value="associative">Associative</option>
			<option value="user">User-defined</option>
		</select>
	</div>

	<div class="field">
		<label for="edgePropStrength">Strength</label>
		<input
			id="edgePropStrength"
			type="number"
			min="1"
			max="5"
			step="1"
			value="1"
		/>
	</div>

	<div class="empty" id="edgeInspectorEmpty">
		No edge selected yet.
	</div>
</aside>
