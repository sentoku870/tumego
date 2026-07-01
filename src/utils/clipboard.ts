// ============ クリップボード ============
// navigator.clipboard.writeText を使用し、失敗した場合は
// 隠し textarea + execCommand にフォールバックする共通ヘルパー。

/**
 * 文字列をクリップボードにコピーする。
 * 失敗時は隠し textarea フォールバックを試み、それでも失敗したら例外を投げる。
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      // フォールバックを試みる
    }
  }
  if (!copyToClipboardFallback(text)) {
    throw new Error('クリップボードへのコピーに失敗しました');
  }
}

export function copyToClipboardFallback(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (error) {
    return false;
  }
}
