// ============ RenderSnapshot Adapter ============
// Renderer を RenderSnapshot インタフェースに適合させるアダプタ。
// composition-root で生成し、BoardCaptureService に渡す。
export class RendererSnapshotAdapter {
    constructor(renderer) {
        this.renderer = renderer;
    }
    renderWithoutHighlight() {
        this.renderer.render({ suppressLastMoveHighlight: true });
    }
    renderNormal() {
        this.renderer.render();
    }
}
//# sourceMappingURL=renderer-snapshot.js.map