// ==========================================
// SGFデータ直接QRコード共有
// ==========================================

// XSS対策用のエスケープ関数
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJsString(str) {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/</g, "\\x3C")  // <script> タグ対策
    .replace(/>/g, "\\x3E");
}

// 安全なイベントハンドラーバインディング
function createPopupElement(id, content) {
  const popup = document.createElement('div');
  popup.id = id;
  popup.innerHTML = content;
  return popup;
}

function createSGFQRCode() {
  try {
    // 現在のSGFデータを直接取得
    const sgfData = exportSGF();
    
    if (!sgfData || sgfData.trim() === '' || sgfData === '(;GM[1]FF[4]SZ[9])') {
      alert('SGFデータがありません。まず石を配置してください。');
      return;
    }

    // 共有方法の選択肢を表示
    showShareMethodSelection(sgfData);

  } catch (error) {
    console.error('QRコード作成エラー:', error);
    alert('エラー: ' + error.message);
  }
}

// 共有方法選択ダイアログ
function showShareMethodSelection(sgfData) {
  const existing = document.getElementById('share-method-popup');
  if (existing) {
    existing.remove();
  }

  const dataLength = sgfData.length;
  const popup = createPopupElement('share-method-popup', `
    <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;">
      <div style="background:white; padding:30px; border-radius:15px; text-align:center; max-width:500px;">
        <h2 style="margin-bottom:20px; color:#333;">📱 共有方法を選択</h2>
        <p style="margin-bottom:25px; color:#666;">SGFデータ（${dataLength}文字）をどの形式で共有しますか？</p>
        <div style="margin:20px 0;">
          <button class="share-auto-load" style="display:block; width:100%; margin:10px 0; padding:15px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">🌐 自動表示QR（読み取ると碁盤が開く）</button>
          <button class="share-direct-sgf" style="display:block; width:100%; margin:10px 0; padding:15px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">📋 SGFデータQR（データをコピー）</button>
        </div>
        <div style="font-size:12px; color:#999; margin-top:15px;">
          自動表示: QRコードを読み取ると直接碁盤が表示<br>
          SGFデータ: QRコードからSGFデータを取得して手動で貼り付け
        </div>
        <button class="share-close" style="margin-top:15px; padding:10px 20px; background:#666; color:white; border:none; border-radius:5px;">❌ キャンセル</button>
      </div>
    </div>
  `);

  // イベントリスナーを安全に追加
  const overlay = popup.querySelector('div');
  overlay.addEventListener('click', closeShareMethodSelection);
  const inner = overlay.querySelector('div');
  inner.addEventListener('click', e => e.stopPropagation());
  
  popup.querySelector('.share-auto-load').addEventListener('click', () => createAutoLoadQR(sgfData));
  popup.querySelector('.share-direct-sgf').addEventListener('click', () => createDirectSGFQR(sgfData));
  popup.querySelector('.share-close').addEventListener('click', closeShareMethodSelection);

  document.body.appendChild(popup);
}

// 自動表示用QRコード（URL方式）
function createAutoLoadQR(sgfData) {
  closeShareMethodSelection();

  const compressed = btoa(sgfData);
  const baseURL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    ? 'https://sentoku870.github.io/tumego/'
    : window.location.origin + window.location.pathname;
  const shareURL = baseURL + '?sgf=' + compressed;

  // URLの長さをチェック
  if (shareURL.length > 2000) {
    alert('⚠️ データが大きすぎてURL形式では共有できません。\nSGFデータ直接方式を使用します。');
    createDirectSGFQR(sgfData);
    return;
  }

  const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=M&data=${encodeURIComponent(shareURL)}`;
  showAutoLoadQRCode(qrURL, shareURL, sgfData);
}

// SGFデータ直接QRコード
function createDirectSGFQR(sgfData) {
  closeShareMethodSelection();
  showSGFQRCode(sgfData);
}

// 自動表示QRコードの表示
function showAutoLoadQRCode(qrURL, shareURL, sgfData) {
  const popup = createPopupElement('auto-load-qr-popup', `
    <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:center;">
      <div style="background:white; padding:25px; border-radius:15px; text-align:center; max-width:90%; max-height:90%;">
        <h2 style="margin-bottom:20px; color:#333;">🌐 自動表示QRコード</h2>
        <div style="background:#e3f2fd; border:1px solid #2196f3; color:#1976d2; padding:15px; border-radius:8px; margin-bottom:20px; font-size:14px;">
          ✨ <strong>便利機能：</strong> QRコードを読み取ると、自動的にブラウザで碁盤が開きます！
        </div>
        <div style="margin:20px 0;">
          <img src="${escapeHtml(qrURL)}" style="max-width:100%; border:2px solid #ddd; border-radius:10px;" alt="Auto-load QR Code">
        </div>
        <p style="margin:15px 0; color:#666; font-size:14px;">📖 <strong>使い方：</strong><br>
        1. QRコードを読み取り<br>
        2. 表示されたURLをタップ<br>
        3. 自動的にブラウザで碁盤が開く</p>
        <div style="margin:20px 0;">
          <button class="auto-copy-url" style="margin:5px; padding:12px 20px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">📋 URLコピー</button>
          <button class="auto-test" style="margin:5px; padding:12px 20px; background:#ff9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">🔍 テスト表示</button>
          <button class="auto-close" style="margin:5px; padding:12px 20px; background:#f44336; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">❌ 閉じる</button>
        </div>
        <div style="font-size:12px; color:#999; margin-top:15px;">URL長: ${shareURL.length} 文字</div>
      </div>
    </div>
  `);

  // イベントリスナー
  const overlay = popup.querySelector('div');
  overlay.addEventListener('click', closeAutoLoadQR);
  const inner = overlay.querySelector('div');
  inner.addEventListener('click', e => e.stopPropagation());
  
  popup.querySelector('.auto-copy-url').addEventListener('click', () => copyAutoLoadURL(shareURL));
  popup.querySelector('.auto-test').addEventListener('click', () => testAutoLoad(shareURL));
  popup.querySelector('.auto-close').addEventListener('click', closeAutoLoadQR);

  document.body.appendChild(popup);
}

function copyAutoLoadURL(url) {
  navigator.clipboard.writeText(url).then(function() {
    alert('🌐 自動表示URLをコピーしました！\nLINEやメールで送信すると、相手がクリックするだけで碁盤が開きます。');
  }).catch(function() {
    prompt('このURLを共有してください:', url);
  });
}

function testAutoLoad(url) {
  window.open(url, '_blank');
}

function closeShareMethodSelection() {
  const popup = document.getElementById('share-method-popup');
  if (popup) {
    popup.remove();
  }
}

function closeAutoLoadQR() {
  const popup = document.getElementById('auto-load-qr-popup');
  if (popup) {
    popup.remove();
  }
}

function showSGFQRCode(sgfData) {
  // 既存のポップアップがあれば削除
  const existing = document.getElementById('sgf-qr-popup');
  if (existing) {
    existing.remove();
  }

  // SGFデータの長さをチェックして最適な設定を選択
  const dataLength = sgfData.length;
  let qrSize, errorCorrectionLevel, warningMessage = '';

  if (dataLength <= 800) {
    qrSize = '300x300';
    errorCorrectionLevel = 'M';
  } else if (dataLength <= 1500) {
    qrSize = '400x400';
    errorCorrectionLevel = 'L';
  } else if (dataLength <= 2500) {
    qrSize = '500x500';
    errorCorrectionLevel = 'L';
    warningMessage = '⚠️ データが大きいため、ハイエンドスマホでの読み取りを推奨します';
  } else {
    showLargeDataOptions(sgfData);
    return;
  }

  // QRコード画像のURL（SGFデータを直接埋め込み）
  const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}&ecc=${errorCorrectionLevel}&data=${encodeURIComponent(sgfData)}`;

  // QRコード表示
  const popup = createPopupElement('sgf-qr-popup', `
    <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:center;">
      <div style="background:white; padding:25px; border-radius:15px; text-align:center; max-width:95%; max-height:95%; box-shadow:0 10px 30px rgba(0,0,0,0.3); overflow:auto;">
        <h2 style="margin-bottom:20px; color:#333;">📱 SGFデータをQRコードで共有</h2>
        ${warningMessage ? `<div style="background:#fff3cd; border:1px solid #ffeaa7; color:#856404; padding:10px; border-radius:5px; margin-bottom:15px; font-size:14px;">${warningMessage}</div>` : ''}
        <div style="margin:20px 0;">
          <img src="${escapeHtml(qrURL)}" style="max-width:100%; max-height:70vh; border:2px solid #ddd; border-radius:10px;" alt="SGF QR Code" onerror="handleQRError(this)">
        </div>
        <p style="margin:15px 0; color:#666; font-size:14px;">📖 <strong>使い方：</strong><br>
        1. QRコードを読み取り<br>
        2. 表示されたSGFデータをコピー<br>
        3. 碁盤アプリで「貼り付け」して読み込み</p>
        <div style="margin:20px 0;">
          <button class="sgf-copy" style="margin:5px; padding:12px 20px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">📋 SGFデータをコピー</button>
          <button class="sgf-preview" style="margin:5px; padding:12px 20px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">👁️ データ確認</button>
          <button class="sgf-close" style="margin:5px; padding:12px 20px; background:#f44336; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">❌ 閉じる</button>
        </div>
        <div style="font-size:12px; color:#999; margin-top:15px;">
          データサイズ: ${dataLength} 文字 | QRサイズ: ${qrSize} | 誤り訂正: ${errorCorrectionLevel}
        </div>
      </div>
    </div>
  `);

  // イベントリスナー
  const overlay = popup.querySelector('div');
  overlay.addEventListener('click', closeSGFQR);
  const inner = overlay.querySelector('div');
  inner.addEventListener('click', e => e.stopPropagation());
  
  popup.querySelector('.sgf-copy').addEventListener('click', () => copySGFData(sgfData));
  popup.querySelector('.sgf-preview').addEventListener('click', () => showSGFPreview(sgfData));
  popup.querySelector('.sgf-close').addEventListener('click', closeSGFQR);

  document.body.appendChild(popup);
}

function copySGFData(sgfData) {
  navigator.clipboard.writeText(sgfData).then(function() {
    alert('📋 SGFデータをクリップボードにコピーしました！\n碁盤アプリで「貼り付け読み込み」してください。');
  }).catch(function() {
    prompt('このSGFデータをコピーしてください:', sgfData);
  });
}

function showSGFPreview(sgfData) {
  // 既存のポップアップがあれば削除
  const existing = document.getElementById('sgf-preview-popup');
  if (existing) {
    existing.remove();
  }

  const previewPopup = createPopupElement('sgf-preview-popup', `
    <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10000; display:flex; justify-content:center; align-items:center;">
      <div style="background:white; padding:20px; border-radius:10px; max-width:80%; max-height:80%; overflow:auto; position:relative;">
        <h3 style="margin-bottom:15px; color:#333;">📄 SGFデータの内容</h3>
        <textarea readonly style="width:100%; height:300px; font-family:monospace; font-size:12px; border:1px solid #ddd; border-radius:5px; padding:10px; background:#f9f9f9; resize:vertical;">${escapeHtml(sgfData)}</textarea>
        <div style="margin-top:15px; text-align:center;">
          <button class="preview-copy" style="margin:5px; padding:12px 20px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer;">📋 コピー</button>
          <button class="preview-close" style="margin:5px; padding:12px 20px; background:#f44336; color:white; border:none; border-radius:8px; cursor:pointer;">❌ 閉じる</button>
        </div>
        <div style="font-size:12px; color:#999; margin-top:10px; text-align:center;">データサイズ: ${sgfData.length} 文字</div>
      </div>
    </div>
  `);

  // イベントリスナー
  const overlay = previewPopup.querySelector('div');
  overlay.addEventListener('click', closeSGFPreview);
  const inner = overlay.querySelector('div');
  inner.addEventListener('click', e => e.stopPropagation());
  
  previewPopup.querySelector('.preview-copy').addEventListener('click', () => copySGFFromPreview(sgfData));
  previewPopup.querySelector('.preview-close').addEventListener('click', closeSGFPreview);

  document.body.appendChild(previewPopup);
}

// プレビューからのコピー専用関数
function copySGFFromPreview(sgfData) {
  navigator.clipboard.writeText(sgfData).then(function() {
    // 一時的な成功メッセージ
    const msg = document.createElement('div');
    msg.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 10001;
      font-size: 14px;
    `;
    msg.textContent = '📋 SGFデータをコピーしました！';
    document.body.appendChild(msg);

    setTimeout(() => msg.remove(), 2000);
  }).catch(function() {
    alert('コピーに失敗しました');
  });
}

// クリーンアップ関数群
function closeSGFQR() {
  const popup = document.getElementById('sgf-qr-popup');
  if (popup) popup.remove();
}

function closeSGFPreview() {
  const popup = document.getElementById('sgf-preview-popup');
  if (popup) popup.remove();
}

// 大容量データ用の選択肢表示
function showLargeDataOptions(sgfData) {
  const popup = createPopupElement('large-data-options', `
    <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;">
      <div style="background:white; padding:30px; border-radius:15px; text-align:center; max-width:500px;">
        <h2 style="color:#ff6b35; margin-bottom:20px;">⚠️ 大容量データ（${sgfData.length}文字）</h2>
        <p style="margin-bottom:25px; line-height:1.5;">データが大きすぎるため、以下の方法から選択してください：</p>
        <div style="margin:20px 0;">
          <button class="large-try-qr" style="display:block; width:100%; margin:10px 0; padding:15px; background:#ff6b35; color:white; border:none; border-radius:8px; cursor:pointer;">🎯 QRコードで挑戦（ハイエンドスマホ推奨）</button>
          <button class="large-compress" style="display:block; width:100%; margin:10px 0; padding:15px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer;">🗜️ 圧縮してQRコード</button>
          <button class="large-url" style="display:block; width:100%; margin:10px 0; padding:15px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer;">🔗 URL共有（推奨）</button>
          <button class="large-copy" style="display:block; width:100%; margin:10px 0; padding:15px; background:#9C27B0; color:white; border:none; border-radius:8px; cursor:pointer;">📋 直接コピー</button>
        </div>
        <button class="large-close" style="margin-top:15px; padding:10px 20px; background:#666; color:white; border:none; border-radius:5px;">❌ キャンセル</button>
      </div>
    </div>
  `);

  // イベントリスナー
  popup.querySelector('.large-try-qr').addEventListener('click', () => tryLargeQRCode(sgfData));
  popup.querySelector('.large-compress').addEventListener('click', () => createCompressedQR(sgfData));
  popup.querySelector('.large-url').addEventListener('click', () => createURLShare(sgfData));
  popup.querySelector('.large-copy').addEventListener('click', () => {
    copySGFData(sgfData);
    closeLargeDataOptions();
  });
  popup.querySelector('.large-close').addEventListener('click', closeLargeDataOptions);

  document.body.appendChild(popup);
}

function tryLargeQRCode(sgfData) {
  closeLargeDataOptions();
  // 警告付きでQRコード生成
  const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&ecc=L&data=${encodeURIComponent(sgfData)}`;
  showQRWithWarning(qrURL, sgfData, '⚠️ 大容量データのため、読み取りは最新のハイエンドスマホを推奨します');
}

function createCompressedQR(sgfData) {
  closeLargeDataOptions();
  const compressed = compressSGFData(sgfData);
  showSGFQRCode(compressed);
}

function createURLShare(sgfData) {
  closeLargeDataOptions();
  const compressed = btoa(sgfData);
  const baseURL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    ? 'https://sentoku870.github.io/tumego/'
    : window.location.origin + window.location.pathname;
  const shareURL = baseURL + '?sgf=' + compressed;
  const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareURL)}`;

  showQRWithWarning(qrURL, shareURL, '🔗 URL共有QRコード（どのスマホでも読み取り可能）');
}

function showQRWithWarning(qrURL, data, warningText) {
  const existing = document.getElementById('qr-with-warning');
  if (existing) {
    existing.remove();
  }

  const popup = createPopupElement('qr-with-warning', `
    <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:center;">
      <div style="background:white; padding:25px; border-radius:15px; text-align:center; max-width:90%;">
        <div style="background:#fff3cd; border:1px solid #ffeaa7; color:#856404; padding:15px; border-radius:8px; margin-bottom:20px;">${escapeHtml(warningText)}</div>
        <img src="${escapeHtml(qrURL)}" style="max-width:100%; border:2px solid #ddd; border-radius:10px;">
        <div style="margin-top:20px;">
          <button class="warning-copy" style="margin:5px; padding:12px 20px; background:#4CAF50; color:white; border:none; border-radius:8px;">📋 データコピー</button>
          <button class="warning-close" style="margin:5px; padding:12px 20px; background:#f44336; color:white; border:none; border-radius:8px;">❌ 閉じる</button>
        </div>
      </div>
    </div>
  `);

  // イベントリスナー
  const overlay = popup.querySelector('div');
  overlay.addEventListener('click', closeQRWithWarning);
  const inner = overlay.querySelector('div');
  inner.addEventListener('click', e => e.stopPropagation());
  
  popup.querySelector('.warning-copy').addEventListener('click', () => copyAdvancedData(data));
  popup.querySelector('.warning-close').addEventListener('click', closeQRWithWarning);

  document.body.appendChild(popup);
}

function copyAdvancedData(data) {
  navigator.clipboard.writeText(data).then(() => {
    alert('📋 データをコピーしました！');
  });
}

function closeLargeDataOptions() {
  const popup = document.getElementById('large-data-options');
  if (popup) popup.remove();
}

function closeQRWithWarning() {
  const popup = document.getElementById('qr-with-warning');
  if (popup) popup.remove();
}

// QRコードエラー処理
window.handleQRError = function(img) {
  img.style.display = 'none';
  const errorMsg = document.createElement('div');
  errorMsg.style.cssText = 'padding:20px; background:#f8d7da; color:#721c24; border:1px solid #f5c6cb; border-radius:5px;';
  errorMsg.textContent = 'QRコードの生成に失敗しました。データが大きすぎる可能性があります。';
  img.parentNode.appendChild(errorMsg);
};