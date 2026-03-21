<div class="node-md-backdrop hidden" id="nodeMdBackdrop"></div>
<div class="node-md-overlay hidden" id="nodeMdOverlay">
    <div class="node-md-header">
        <div class="node-md-title" id="nodeMdTitle">NODE MARKDOWN</div>
        <div class="node-md-tabs" id="nodeMdTabs">
            <button type="button" data-view="write" class="active">Write</button
            >
            <button type="button" data-view="preview">Preview</button>
        </div>
        <button type="button" class="node-md-close" id="nodeMdClose">
            Close
        </button>
    </div>
    <div class="node-md-body">
        <textarea
            class="node-md-editor"
            id="nodeMdEditor"
            maxlength="4000"
            placeholder="# Heading
Write **markdown** here..."
        ></textarea>
        <div
            class="node-md-preview hidden"
            id="nodeMdPreview"
            aria-live="polite"
        ></div>
    </div>
</div>
