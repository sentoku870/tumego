// ============ DOM 要素取得ヘルパ ============
// index.html に静的に定義された要素への参照を一元化する。
// 新しいユーティリティを追加する場合は、ここに集約する。
/**
 * SGF テキストエリア (`#sgf-text`) を取得する。
 * - 存在しない場合は null を返す（呼び出し側で null チェックする）。
 * - 見つからない場合（テスト環境等）でも throw しない。
 */
export function getSgfTextarea() {
    return document.getElementById('sgf-text');
}
//# sourceMappingURL=dom-elements.js.map