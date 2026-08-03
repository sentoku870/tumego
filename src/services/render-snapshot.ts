// ============ RenderSnapshot インタフェース ============
// BoardCaptureService (サービス層) が Renderer (描画層) に直接依存しないように、
// 描画呼び出しを抽象化する。

export interface RenderSnapshot {
  /** 直前の手ハイライトを消した状態で描画する（盤面保存用） */
  renderWithoutHighlight(): void;
  /** 通常描画（ハイライトあり） */
  renderNormal(): void;
}
