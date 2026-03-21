<aside class="node-inspector" id="nodeInspector">
    <h3>NODE INSPECTOR</h3>
    <p class="inspector-sub">
        Select a node to edit label/content. In preview mode fields are
        read-only.
    </p>

    <div class="field">
        <label for="nodeText">Node text</label>
        <textarea
            id="nodeText"
            maxlength="4000"
            placeholder="Node text..."
        ></textarea>
    </div>

    <div class="field">
        <button
            id="nodeMdOpenBtn"
            type="button"
            class="pill-btn"
            style="align-self: flex-start"
        >
            Open Markdown Modal
        </button>
    </div>

    <div class="field">
        <label for="nodeType">Node type</label>
        <select id="nodeType">
            <option value="normal">Normal</option>
            <option value="stargate">Stargate</option>
        </select>
    </div>

    <div class="field">
        <label for="nodePinned">Pinned</label>
        <select id="nodePinned">
            <option value="false">No</option>
            <option value="true">Yes</option>
        </select>
    </div>

    <div class="empty" id="nodeInspectorEmpty">
        No node selected yet.
    </div>
</aside>
