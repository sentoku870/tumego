// ============ OutsideClickListener ============
// document への click リスナーを集約し、指定ターゲット要素の内外で
// 処理を分岐する。dropdown / palette / modal の「外側クリックで閉じる」
// パターンの共通実装。
//
// 使用例:
//   const unsubscribe = listener.subscribe(
//     [dropdown, button],
//     () => this.dropdownManager.hide(dropdown)
//   );
//   // コンポーネント破棄時に:
//   unsubscribe();

export type OutsideClickHandler = (event: MouseEvent) => void;

export class OutsideClickListener {
  /**
   * document に click リスナーを登録し、`targets` のいずれかに
   * 含まれていないクリックでのみ `handler` を呼ぶ。
   *
   * @param targets この要素群の内側をクリックした場合は handler を呼ばない
   * @param handler document クリック時に呼ばれるハンドラ
   * @returns 購読解除関数
   */
  subscribe(targets: readonly Element[], handler: OutsideClickHandler): () => void {
    const documentHandler: OutsideClickHandler = (event) => {
      const target = event.target as Node | null;
      if (target && targets.some((t) => t.contains(target))) {
        return;
      }
      handler(event);
    };
    document.addEventListener('click', documentHandler);
    return () => {
      document.removeEventListener('click', documentHandler);
    };
  }
}
