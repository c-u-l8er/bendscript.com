import { derived, writable } from "svelte/store";

const initialUIState = {
	selectedNodeId: null,
	selectedEdgeId: null,
	editMode: "edit", // "edit" | "preview"

	composerPos: {
		free: false,
		x: 0,
		y: 0
	},

	mergeSourceNodeId: null,
	connectSourceNodeId: null,

	contextMenuState: {
		visible: false,
		x: 0,
		y: 0,
		nodeId: null
	},

	hintText: "",

	markdownModal: {
		open: false,
		view: "write", // "write" | "preview"
		boundNodeId: null,
		closedByUser: false
	}
};

export const uiState = writable(structuredClone(initialUIState));

// Selection stores
export const selectedNodeId = derived(uiState, ($ui) => $ui.selectedNodeId);
export const selectedEdgeId = derived(uiState, ($ui) => $ui.selectedEdgeId);

// Mode / composer
export const editMode = derived(uiState, ($ui) => $ui.editMode);
export const composerPos = derived(uiState, ($ui) => $ui.composerPos);

// Menu / interaction modes
export const mergeSourceNodeId = derived(uiState, ($ui) => $ui.mergeSourceNodeId);
export const connectSourceNodeId = derived(uiState, ($ui) => $ui.connectSourceNodeId);
export const contextMenuState = derived(uiState, ($ui) => $ui.contextMenuState);
export const hintText = derived(uiState, ($ui) => $ui.hintText);

// Markdown modal
export const markdownModalOpen = derived(uiState, ($ui) => $ui.markdownModal.open);
export const markdownModalView = derived(uiState, ($ui) => $ui.markdownModal.view);
export const markdownModalBoundNodeId = derived(uiState, ($ui) => $ui.markdownModal.boundNodeId);

// Actions
export function setSelectedNode(nodeId) {
	uiState.update((ui) => ({
		...ui,
		selectedNodeId: nodeId ?? null,
		selectedEdgeId: null
	}));
}

export function setSelectedEdge(edgeId) {
	uiState.update((ui) => ({
		...ui,
		selectedEdgeId: edgeId ?? null
	}));
}

export function clearSelection() {
	uiState.update((ui) => ({
		...ui,
		selectedNodeId: null,
		selectedEdgeId: null
	}));
}

export function setEditMode(mode) {
	const next = mode === "preview" ? "preview" : "edit";
	uiState.update((ui) => ({ ...ui, editMode: next }));
}

export function setComposerPos(pos = {}) {
	uiState.update((ui) => ({
		...ui,
		composerPos: {
			free: !!pos.free,
			x: Number(pos.x) || 0,
			y: Number(pos.y) || 0
		}
	}));
}

export function enterMergeMode(sourceNodeId) {
	uiState.update((ui) => ({
		...ui,
		mergeSourceNodeId: sourceNodeId ?? null,
		connectSourceNodeId: null
	}));
}

export function enterConnectMode(sourceNodeId) {
	uiState.update((ui) => ({
		...ui,
		connectSourceNodeId: sourceNodeId ?? null,
		mergeSourceNodeId: null
	}));
}

export function clearLinkModes() {
	uiState.update((ui) => ({
		...ui,
		mergeSourceNodeId: null,
		connectSourceNodeId: null
	}));
}

export function openContextMenu({ x = 0, y = 0, nodeId = null } = {}) {
	uiState.update((ui) => ({
		...ui,
		contextMenuState: {
			visible: true,
			x: Number(x) || 0,
			y: Number(y) || 0,
			nodeId: nodeId ?? null
		}
	}));
}

export function closeContextMenu() {
	uiState.update((ui) => ({
		...ui,
		contextMenuState: {
			visible: false,
			x: 0,
			y: 0,
			nodeId: null
		}
	}));
}

export function setHintText(text = "") {
	uiState.update((ui) => ({
		...ui,
		hintText: String(text)
	}));
}

export function openMarkdownModal({ nodeId = null, view = "write" } = {}) {
	uiState.update((ui) => ({
		...ui,
		markdownModal: {
			open: true,
			view: view === "preview" ? "preview" : "write",
			boundNodeId: nodeId ?? ui.selectedNodeId ?? null,
			closedByUser: false
		}
	}));
}

export function closeMarkdownModal({ closedByUser = true } = {}) {
	uiState.update((ui) => ({
		...ui,
		markdownModal: {
			...ui.markdownModal,
			open: false,
			closedByUser: !!closedByUser
		}
	}));
}

export function setMarkdownModalView(view) {
	uiState.update((ui) => ({
		...ui,
		markdownModal: {
			...ui.markdownModal,
			view: view === "preview" ? "preview" : "write"
		}
	}));
}

export function resetUIState() {
	uiState.set(structuredClone(initialUIState));
}
