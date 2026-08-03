// ============ RenderSnapshot Adapter ============
// Renderer を RenderSnapshot インタフェースに適合させるアダプタ。
// composition-root で生成し、BoardCaptureService に渡す。

import { Renderer } from './renderer.js';
import { RenderSnapshot } from '../services/render-snapshot.js';

export class RendererSnapshotAdapter implements RenderSnapshot {
  constructor(private readonly renderer: Renderer) {}

  renderWithoutHighlight(): void {
    this.renderer.render({ suppressLastMoveHighlight: true });
  }

  renderNormal(): void {
    this.renderer.render();
  }
}
