// ==========================================
// SGFデータ直接QRコード共有
// ==========================================

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
  const popup = document.createElement('div');
  popup.id = 'share-method-popup';
  popup.innerHTML =
    '<div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;">' +
    '<div style="background:white; padding:30px; border-radius:15px; text-align:center; max-width:500px;">' +
    '<h2 style="margin-bottom:20px; color:#333;">📱 共有方法を選択</h2>' +
    '<p style="margin-bottom:25px; color:#666;">SGFデータ（' + dataLength + '文字）をどの形式で共有しますか？</p>' +
    '<div style="margin:20px 0;">' +
    '<button onclick="createAutoLoadQR(\'' + sgfData.replace(/'/g, "\\'") + '\')" style="display:block; width:100%; margin:10px 0; padding:15px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">🌐 自動表示QR（読み取ると碁盤が開く）</button>' +
    '<button onclick="createDirectSGFQR(\'' + sgfData.replace(/'/g, "\\'") + '\')" style="display:block; width:100%; margin:10px 0; padding:15px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">📋 SGFデータQR（データをコピー）</button>' +
    '</div>' +
    '<div style="font-size:12px; color:#999; margin-top:15px;">' +
    '自動表示: QRコードを読み取ると直接碁盤が表示<br>' +
    'SGFデータ: QRコードからSGFデータを取得して手動で貼り付け' +
    '</div>' +
    '<button onclick="closeShareMethodSelection()" style="margin-top:15px; padding:10px 20px; background:#666; color:white; border:none; border-radius:5px;">❌ キャンセル</button>' +
    '</div>' +
    '</div>';

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
  const popup = document.createElement('div');
  popup.id = 'auto-load-qr-popup';
  popup.innerHTML =
    '<div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:center;" onclick="closeAutoLoadQR()">' +
    '<div style="background:white; padding:25px; border-radius:15px; text-align:center; max-width:90%; max-height:90%;" onclick="event.stopPropagation()">' +
    '<h2 style="margin-bottom:20px; color:#333;">🌐 自動表示QRコード</h2>' +
    '<div style="background:#e3f2fd; border:1px solid #2196f3; color:#1976d2; padding:15px; border-radius:8px; margin-bottom:20px; font-size:14px;">' +
    '✨ <strong>便利機能：</strong> QRコードを読み取ると、自動的にブラウザで碁盤が開きます！' +
    '</div>' +
    '<div style="margin:20px 0;">' +
    '<img src="' + qrURL + '" style="max-width:100%; border:2px solid #ddd; border-radius:10px;" alt="Auto-load QR Code">' +
    '</div>' +
    '<p style="margin:15px 0; color:#666; font-size:14px;">📖 <strong>使い方：</strong><br>' +
    '1. QRコードを読み取り<br>' +
    '2. 表示されたURLをタップ<br>' +
    '3. 自動的にブラウザで碁盤が開く</p>' +
    '<div style="margin:20px 0;">' +
    '<button onclick="copyAutoLoadURL(\'' + shareURL.replace(/'/g, "\\'") + '\')" style="margin:5px; padding:12px 20px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">📋 URLコピー</button>' +
    '<button onclick="testAutoLoad(\'' + shareURL.replace(/'/g, "\\'") + '\')" style="margin:5px; padding:12px 20px; background:#ff9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">🔍 テスト表示</button>' +
    '<button onclick="closeAutoLoadQR()" style="margin:5px; padding:12px 20px; background:#f44336; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">❌ 閉じる</button>' +
    '</div>' +
    '<div style="font-size:12px; color:#999; margin-top:15px;">URL長: ' + shareURL.length + ' 文字</div>' +
    '</div>' +
    '</div>';

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
  // 新しいタブで開いてテスト
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
    // 800文字以下: 高品質
    qrSize = '300x300';
    errorCorrectionLevel = 'M';
  } else if (dataLength <= 1500) {
    // 1500文字以下: 中品質・大サイズ
    qrSize = '400x400';
    errorCorrectionLevel = 'L';
  } else if (dataLength <= 2500) {
    // 2500文字以下: 低品質・最大サイズ
    qrSize = '500x500';
    errorCorrectionLevel = 'L';
    warningMessage = '⚠️ データが大きいため、ハイエンドスマホでの読み取りを推奨します';
  } else {
    // 2500文字超: 複数の共有方法を提案
    showLargeDataOptions(sgfData);
    return;
  }

  // QRコード画像のURL（SGFデータを直接埋め込み）
  const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}&ecc=${errorCorrectionLevel}&data=${encodeURIComponent(sgfData)}`;

  // QRコード表示
  const popup = document.createElement('div');
  popup.id = 'sgf-qr-popup';
  popup.innerHTML =
    '<div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:center;" onclick="closeSGFQR()">' +
    '<div style="background:white; padding:25px; border-radius:15px; text-align:center; max-width:95%; max-height:95%; box-shadow:0 10px 30px rgba(0,0,0,0.3); overflow:auto;" onclick="event.stopPropagation()">' +
    '<h2 style="margin-bottom:20px; color:#333;">📱 SGFデータをQRコードで共有</h2>' +
    (warningMessage ? '<div style="background:#fff3cd; border:1px solid #ffeaa7; color:#856404; padding:10px; border-radius:5px; margin-bottom:15px; font-size:14px;">' + warningMessage + '</div>' : '') +
    '<div style="margin:20px 0;">' +
    '<img src="' + qrURL + '" style="max-width:100%; max-height:70vh; border:2px solid #ddd; border-radius:10px;" alt="SGF QR Code" onerror="handleQRError(this)">' +
    '</div>' +
    '<p style="margin:15px 0; color:#666; font-size:14px;">📖 <strong>使い方：</strong><br>' +
    '1. QRコードを読み取り<br>' +
    '2. 表示されたSGFデータをコピー<br>' +
    '3. 碁盤アプリで「貼り付け」して読み込み</p>' +
    '<div style="margin:20px 0;">' +
    '<button onclick="copySGFData(\'' + sgfData.replace(/'/g, "\\'") + '\')" style="margin:5px; padding:12px 20px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">📋 SGFデータをコピー</button>' +
    '<button onclick="showSGFPreview(\'' + sgfData.replace(/'/g, "\\'") + '\')" style="margin:5px; padding:12px 20px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">👁️ データ確認</button>' +
    '<button onclick="closeSGFQR()" style="margin:5px; padding:12px 20px; background:#f44336; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">❌ 閉じる</button>' +
    '</div>' +
    '<div style="font-size:12px; color:#999; margin-top:15px;">' +
    'データサイズ: ' + dataLength + ' 文字 | QRサイズ: ' + qrSize + ' | 誤り訂正: ' + errorCorrectionLevel +
    '</div>' +
    '</div>' +
    '</div>';

  document.body.appendChild(popup);
}

function showManualSGFInput() {
  // 手動入力用のダイアログ
  const popup = document.createElement('div');
  popup.id = 'manual-sgf-input-popup';
  popup.innerHTML =
    '<div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;">' +
    '<div style="background:white; padding:20px; border-radius:10px; text-align:center; max-width:500px;">' +
    '<h3>📝 SGFデータを手動入力</h3>' +
    '<p>SGFコピーボタンを押してから、ここに貼り付けてください</p>' +
    '<textarea id="manual-sgf-input" placeholder="SGFデータを貼り付け..." style="width:100%; height:150px; margin:10px 0; font-family:monospace; font-size:12px; border:1px solid #ddd; border-radius:5px; padding:10px;"></textarea>' +
    '<div>' +
    '<button onclick="processManualSGF()" style="margin:5px; padding:12px 20px; background:#4CAF50; color:white; border:none; border-radius:5px;">✅ QRコード作成</button>' +
    '<button onclick="closeManualSGFInput()" style="margin:5px; padding:12px 20px; background:#f44336; color:white; border:none; border-radius:5px;">❌ キャンセル</button>' +
    '</div>' +
    '</div>' +
    '</div>';

  document.body.appendChild(popup);

  // テキストエリアにフォーカス
  setTimeout(function() {
    document.getElementById('manual-sgf-input').focus();
  }, 100);
}

function processManualSGF() {
  const sgfData = document.getElementById('manual-sgf-input').value.trim();
  if (!sgfData) {
    alert('SGFデータを入力してください');
    return;
  }

  closeManualSGFInput();
  showSGFQRCode(sgfData);
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

  const previewPopup = document.createElement('div');
  previewPopup.id = 'sgf-preview-popup';

  // SGFデータのHTMLエスケープ処理
  const escapedSGF = sgfData
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // コピー用の安全なデータ
  const safeDataForCopy = sgfData.replace(/'/g, "\\'").replace(/"/g, '\\"');

  previewPopup.innerHTML =
    '<div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10000; display:flex; justify-content:center; align-items:center;" onclick="closeSGFPreview()">' +
    '<div style="background:white; padding:20px; border-radius:10px; max-width:80%; max-height:80%; overflow:auto; position:relative;" onclick="event.stopPropagation()">' +
    '<h3 style="margin-bottom:15px; color:#333;">📄 SGFデータの内容</h3>' +
    '<textarea readonly style="width:100%; height:300px; font-family:monospace; font-size:12px; border:1px solid #ddd; border-radius:5px; padding:10px; background:#f9f9f9; resize:vertical;">' + escapedSGF + '</textarea>' +
    '<div style="margin-top:15px; text-align:center;">' +
    '<button onclick="copySGFFromPreview(\'' + safeDataForCopy + '\')" style="margin:5px; padding:12px 20px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer;">📋 コピー</button>' +
    '<button onclick="closeSGFPreview()" style="margin:5px; padding:12px 20px; background:#f44336; color:white; border:none; border-radius:8px; cursor:pointer;">❌ 閉じる</button>' +
    '</div>' +
    '<div style="font-size:12px; color:#999; margin-top:10px; text-align:center;">データサイズ: ' + sgfData.length + ' 文字</div>' +
    '</div>' +
    '</div>';

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

function closeManualSGFInput() {
  const popup = document.getElementById('manual-sgf-input-popup');
  if (popup) popup.remove();
}

function closeSGFPreview() {
  const popup = document.getElementById('sgf-preview-popup');
  if (popup) popup.remove();
}

// 大容量データ用の選択肢表示
function showLargeDataOptions(sgfData) {
  const popup = document.createElement('div');
  popup.id = 'large-data-options';
  popup.innerHTML =
    '<div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;">' +
    '<div style="background:white; padding:30px; border-radius:15px; text-align:center; max-width:500px;">' +
    '<h2 style="color:#ff6b35; margin-bottom:20px;">⚠️ 大容量データ（' + sgfData.length + '文字）</h2>' +
    '<p style="margin-bottom:25px; line-height:1.5;">データが大きすぎるため、以下の方法から選択してください：</p>' +
    '<div style="margin:20px 0;">' +
    '<button onclick="tryLargeQRCode(\'' + sgfData.replace(/'/g, "\\'") + '\')" style="display:block; width:100%; margin:10px 0; padding:15px; background:#ff6b35; color:white; border:none; border-radius:8px; cursor:pointer;">🎯 QRコードで挑戦（ハイエンドスマホ推奨）</button>' +
    '<button onclick="createCompressedQR(\'' + sgfData.replace(/'/g, "\\'") + '\')" style="display:block; width:100%; margin:10px 0; padding:15px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer;">🗜️ 圧縮してQRコード</button>' +
    '<button onclick="createURLShare(\'' + sgfData.replace(/'/g, "\\'") + '\')" style="display:block; width:100%; margin:10px 0; padding:15px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer;">🔗 URL共有（推奨）</button>' +
    '<button onclick="copySGFData(\'' + sgfData.replace(/'/g, "\\'") + '\')" style="display:block; width:100%; margin:10px 0; padding:15px; background:#9C27B0; color:white; border:none; border-radius:8px; cursor:pointer;">📋 直接コピー</button>' +
    '</div>' +
    '<button onclick="closeLargeDataOptions()" style="margin-top:15px; padding:10px 20px; background:#666; color:white; border:none; border-radius:5px;">❌ キャンセル</button>' +
    '</div>' +
    '</div>';

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
  // URL共有機能（以前作成したもの）
  const compressed = btoa(sgfData);
  const baseURL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    ? 'https://sentoku870.github.io/tumego/'
    : window.location.origin + window.location.pathname;
  const shareURL = baseURL + '?sgf=' + compressed;
  const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareURL)}`;

  showQRWithWarning(qrURL, shareURL, '🔗 URL共有QRコード（どのスマホでも読み取り可能）');
}

function showQRWithWarning(qrURL, data, warningText) {
  // 既存のポップアップがあれば削除
  const existing = document.getElementById('qr-with-warning');
  if (existing) {
    existing.remove();
  }

  const popup = document.createElement('div');
  popup.id = 'qr-with-warning';
  popup.innerHTML =
    '<div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:center;" onclick="closeQRWithWarning()">' +
    '<div style="background:white; padding:25px; border-radius:15px; text-align:center; max-width:90%;" onclick="event.stopPropagation()">' +
    '<div style="background:#fff3cd; border:1px solid #ffeaa7; color:#856404; padding:15px; border-radius:8px; margin-bottom:20px;">' + warningText + '</div>' +
    '<img src="' + qrURL + '" style="max-width:100%; border:2px solid #ddd; border-radius:10px;">' +
    '<div style="margin-top:20px;">' +
    '<button onclick="copyAdvancedData(\'' + data.replace(/'/g, "\\'") + '\')" style="margin:5px; padding:12px 20px; background:#4CAF50; color:white; border:none; border-radius:8px;">📋 データコピー</button>' +
    '<button onclick="closeQRWithWarning()" style="margin:5px; padding:12px 20px; background:#f44336; color:white; border:none; border-radius:8px;">❌ 閉じる</button>' +
    '</div>' +
    '</div>' +
    '</div>';

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

// QRコード関連の関数をグローバルスコープに登録（ポップアップ内で使用するため）
window.createAutoLoadQR = createAutoLoadQR;
window.createDirectSGFQR = createDirectSGFQR;
window.closeShareMethodSelection = closeShareMethodSelection;
window.closeAutoLoadQR = closeAutoLoadQR;
window.copyAutoLoadURL = copyAutoLoadURL;
window.testAutoLoad = testAutoLoad;
window.showManualSGFInput = showManualSGFInput;
window.processManualSGF = processManualSGF;
window.closeManualSGFInput = closeManualSGFInput;
window.copySGFData = copySGFData;
window.showSGFPreview = showSGFPreview;
window.copySGFFromPreview = copySGFFromPreview;
window.closeSGFQR = closeSGFQR;
window.closeSGFPreview = closeSGFPreview;
window.tryLargeQRCode = tryLargeQRCode;
window.createCompressedQR = createCompressedQR;
window.createURLShare = createURLShare;
window.showLargeDataOptions = showLargeDataOptions;
window.closeLargeDataOptions = closeLargeDataOptions;
window.closeQRWithWarning = closeQRWithWarning;
window.copyAdvancedData = copyAdvancedData;