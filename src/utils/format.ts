// ============ 文字変換ユーティリティ ============
// 数字を丸数字（①〜㊿）に変換する純粋関数。
// 描画 (view-model) と SGF 解答シーケンス (sgf-service) で同じ実装を
// 重複して持たないために共通化する。

const MAX_CIRCLED_NUMBER = 50;

/**
 * 1-50 を丸数字（①〜㊿）に変換する。範囲外は数字のまま。
 * - 1-20: ①〜⑳
 * - 21-35: ㉑〜㉟
 * - 36-50: ㊱〜㊿
 */
export function toCircledNumber(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCharCode(0x2460 + n - 1);
  if (n >= 21 && n <= 35) return String.fromCharCode(0x3251 + n - 21);
  if (n >= 36 && n <= MAX_CIRCLED_NUMBER) return String.fromCharCode(0x32b1 + n - 36);
  return n.toString();
}
