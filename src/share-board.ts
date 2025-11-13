const BOARD_CANVAS_ID = 'boardCanvas';

type PlatformType = 'windows' | 'mac' | 'android' | 'ios' | 'other';

function detectPlatform(): PlatformType {
  const uaDataPlatform = (navigator as any).userAgentData?.platform?.toLowerCase?.() ?? '';
  const platform = navigator.platform?.toLowerCase?.() ?? '';
  const userAgent = navigator.userAgent?.toLowerCase?.() ?? '';

  if (uaDataPlatform.includes('windows') || platform.includes('win') || userAgent.includes('windows')) {
    return 'windows';
  }

  if (uaDataPlatform.includes('mac') || platform.includes('mac') || userAgent.includes('macintosh')) {
    // iPadOS reports Mac in userAgentData/platform when using desktop mode.
    const isTouchMac = /macintosh/.test(userAgent) && 'ontouchend' in document;
    return isTouchMac ? 'ios' : 'mac';
  }

  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'ios';
  }

  if (uaDataPlatform.includes('android') || /android/.test(userAgent)) {
    return 'android';
  }

  return 'other';
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('画像データの生成に失敗しました'));
      }
    }, 'image/png');
  });
}

async function copyImageToClipboard(blob: Blob): Promise<void> {
  if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function') {
    throw new Error('クリップボードへのコピーに対応していません');
  }

  if (typeof ClipboardItem === 'undefined') {
    throw new Error('ClipboardItem が利用できません');
  }

  const clipboardItem = new ClipboardItem({ 'image/png': blob });
  await navigator.clipboard.write([clipboardItem]);
}

async function shareImage(blob: Blob): Promise<void> {
  if (typeof File === 'undefined') {
    throw new Error('File API に対応していません');
  }

  const file = new File([blob], 'board.png', { type: 'image/png' });

  if (navigator.canShare && !navigator.canShare({ files: [file] })) {
    throw new Error('この端末は画像共有に対応していません');
  }

  if (typeof navigator.share !== 'function') {
    throw new Error('共有機能が利用できません');
  }

  await navigator.share({
    files: [file],
    title: 'Tumego 盤面',
    text: '現在の盤面を共有します'
  });
}

export async function copyOrShareBoardCanvas(): Promise<void> {
  try {
    const element = document.getElementById(BOARD_CANVAS_ID);
    if (!element || !(element instanceof HTMLCanvasElement)) {
      throw new Error('盤面Canvasが見つかりません');
    }

    const blob = await canvasToBlob(element);
    const platform = detectPlatform();

    if (platform === 'windows' || platform === 'mac') {
      await copyImageToClipboard(blob);
      alert('盤面画像をクリップボードにコピーしました');
      return;
    }

    if (platform === 'android') {
      if (navigator.clipboard && typeof navigator.clipboard.write === 'function') {
        await copyImageToClipboard(blob);
        alert('盤面画像をクリップボードにコピーしました');
      } else {
        await shareImage(blob);
      }
      return;
    }

    if (platform === 'ios') {
      await shareImage(blob);
      return;
    }

    // Fallback: try clipboard first, then share
    try {
      await copyImageToClipboard(blob);
      alert('盤面画像をクリップボードにコピーしました');
    } catch (clipboardError) {
      await shareImage(blob);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラーが発生しました';
    alert(`盤面画像のコピー/共有に失敗しました: ${message}`);
  }
}

if (typeof window !== 'undefined') {
  (window as any).copyOrShareBoardCanvas = copyOrShareBoardCanvas;
}
