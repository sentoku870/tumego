import { Renderer } from '../renderer.js';

export class BoardCaptureService {
  constructor(
    private readonly svgElement: SVGSVGElement,
    private readonly renderer: Renderer
  ) {}

  async captureBoard(): Promise<void> {
    try {
      // SVG から PNG Blob を生成
      const pngBlob = await this.convertSvgToPng(this.svgElement);

      const clipboardWritable = typeof navigator.clipboard?.write === 'function';
      const clipboardItemCtor = (window as Window & {
        ClipboardItem?: new (items: Record<string, Blob | Promise<Blob>>) => ClipboardItem;
      }).ClipboardItem;

      const isIOS =
        /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.userAgent.includes('Mac') && 'ontouchend' in document);

      // クリップボードに PNG を書き込み（対応ブラウザのみ）
      if (clipboardWritable && clipboardItemCtor) {
        try {
          const item = new clipboardItemCtor({ 'image/png': pngBlob });
          await navigator.clipboard!.write([item]);
          this.renderer.showMessage('コピーしました');
          return;
        } catch (error) {
          console.error('クリップボードへの書き込みに失敗しました', error);
          if (!isIOS) {
            alert('クリップボードにコピーできなかったため画像を表示します');
          }
        }
      }

      // クリップボードが使えない場合はプレビュー表示
      const dataUrl = await this.blobToDataUrl(pngBlob);
      if (!dataUrl) {
        throw new Error('PNGの生成に失敗しました');
      }

      this.showBoardPreviewModal(dataUrl);
    } catch (error) {
      console.error('盤面キャプチャに失敗しました', error);
      this.renderer.showMessage('盤面画像の生成に失敗しました');
    }
  }

  private async blobToDataUrl(blob: Blob): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === 'string' ? reader.result : null);
      };
      reader.onerror = () => {
        console.warn('DataURL の生成に失敗しました', reader.error);
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  }

  private showBoardPreviewModal(imageUrl: string): void {
    const existingOverlay = document.getElementById('board-preview-overlay');
    existingOverlay?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'board-preview-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '1000';

    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.backgroundColor = '#ffffff';
    container.style.padding = '16px';
    container.style.borderRadius = '12px';
    container.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.25)';

    const closeButton = document.createElement('button');
    closeButton.textContent = '閉じる';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '8px';
    closeButton.style.right = '8px';
    closeButton.style.padding = '6px 12px';
    closeButton.style.backgroundColor = '#333';
    closeButton.style.color = '#fff';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '4px';
    closeButton.style.cursor = 'pointer';
    closeButton.addEventListener('click', () => {
      overlay.remove();
    });

    const image = document.createElement('img');
    image.id = 'board-preview';
    image.src = imageUrl;
    image.alt = '盤面プレビュー';
    image.style.display = 'block';
    image.style.maxWidth = '90vw';
    image.style.maxHeight = '80vh';
    image.style.borderRadius = '8px';

    container.appendChild(closeButton);
    container.appendChild(image);
    overlay.appendChild(container);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        overlay.remove();
      }
    });

    document.body.appendChild(overlay);
  }

  /**
   * SVG をクローンして CSS 変数を反映し、PNG Blob を生成
   * DOM 上の <canvas> 要素は使わず、都度メモリ上に canvas を作る
   */
  private async convertSvgToPng(svgElement: SVGSVGElement): Promise<Blob> {
      const inlineSvg = svgElement.cloneNode(true) as SVGSVGElement;
      const rootStyle = getComputedStyle(document.documentElement);

    // ==== viewBox の内部サイズを取得（描画と完全一致） ====
    const { width, height } = this.getSvgRenderSize(svgElement);

    if (!width || !height) {
      throw new Error('SVGのサイズを取得できません');
    }

    // PNG 用の SVG に内部座標と同じサイズを設定
    inlineSvg.setAttribute('width', width.toString());
    inlineSvg.setAttribute('height', height.toString());

    // テーマ用の CSS カスタムプロパティを埋め込む
    const cssVariables = ['--board', '--line', '--star', '--coord', '--black', '--white'];
    cssVariables.forEach((name) => {
      const value = rootStyle.getPropertyValue(name);
      if (value) {
        inlineSvg.style.setProperty(name, value.trim());
      }
    });

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(inlineSvg);

    // xmlns がない場合は付与
    if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
      svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!svgString.includes('xmlns:xlink="http://www.w3.org/1999/xlink"')) {
      svgString = svgString.replace('<svg', '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      const image = new Image();
      const revokeUrl = () => URL.revokeObjectURL(url);

      image.onload = () => {
        try {
          // DOM に追加しない一時 canvas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext('2d');
          if (!context) {
            revokeUrl();
            reject(new Error('Canvas コンテキストを取得できません'));
            return;
          }

          const boardColor = rootStyle.getPropertyValue('--board').trim() || '#ffffff';
          context.clearRect(0, 0, width, height);
          context.fillStyle = boardColor;
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);

          canvas.toBlob((blob) => {
            revokeUrl();
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('PNG生成に失敗しました'));
            }
          }, 'image/png');
        } catch (error) {
          revokeUrl();
          reject(error as Error);
        }
      };

      image.onerror = () => {
        revokeUrl();
        reject(new Error('SVG画像の読み込みに失敗しました'));
      };

      image.src = url;
    });

    return pngBlob;
  }

  private getSvgRenderSize(svgElement: SVGSVGElement): { width: number; height: number } {
    const viewBox = svgElement.viewBox?.baseVal;
    const rect = svgElement.getBoundingClientRect();

    const widthCandidate =
      viewBox?.width ??
      svgElement.clientWidth ??
      rect.width ??
      Number(svgElement.getAttribute('width'));

    const heightCandidate =
      viewBox?.height ??
      svgElement.clientHeight ??
      rect.height ??
      Number(svgElement.getAttribute('height'));

    const width = Number.isFinite(widthCandidate) ? Math.round(widthCandidate) : 0;
    const height = Number.isFinite(heightCandidate) ? Math.round(heightCandidate) : 0;

    return { width, height };
  }
}
