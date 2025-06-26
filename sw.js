// Service Worker for Tumego PWA
// iPhone・iPad向け最適化されたオフライン対応

const CACHE_NAME = 'tumego-v1.0.0';
const urlsToCache = [
  './',
  './index.html',
  './layout.css',
  './board.css',
  './tumego-core.js',
  './tumego-render.js',
  './tumego-sgf.js',
  './tumego-events.js',
  './tumego-qr.js',
  './tumego-main.js',
  './manifest.json'
];

// インストール時のキャッシュ処理
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Cached all files successfully');
        return self.skipWaiting(); // 即座にアクティベート
      })
      .catch(error => {
        console.error('Service Worker: Cache failed', error);
      })
  );
});

// アクティベート時の古いキャッシュ削除
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated successfully');
      return self.clients.claim(); // 即座に制御開始
    })
  );
});

// フェッチ時のキャッシュ戦略（Cache First with Network Fallback）
self.addEventListener('fetch', event => {
  // POSTリクエストやクロスオリジンリクエストは処理しない
  if (event.request.method !== 'GET' || 
      !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // キャッシュにあればそれを返す
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }

        // キャッシュになければネットワークから取得
        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request).then(response => {
          // レスポンスが有効でない場合はそのまま返す
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // レスポンスをクローン（ストリームは一度しか読めないため）
          const responseToCache = response.clone();

          // 重要なファイルのみキャッシュに追加
          if (shouldCache(event.request)) {
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('Service Worker: Cached new resource', event.request.url);
              });
          }

          return response;
        });
      })
      .catch(error => {
        console.error('Service Worker: Fetch failed', error);
        
        // オフライン時のフォールバック
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
        
        // その他のリソースで失敗した場合
        return new Response('オフラインです', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain; charset=utf-8'
          })
        });
      })
  );
});

// キャッシュすべきリクエストかどうかを判定
function shouldCache(request) {
  const url = new URL(request.url);
  
  // 同一オリジンのリソースのみ
  if (url.origin !== self.location.origin) {
    return false;
  }
  
  // キャッシュ対象の拡張子
  const cacheableExtensions = ['.html', '.css', '.js', '.json', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
  const pathname = url.pathname.toLowerCase();
  
  return cacheableExtensions.some(ext => pathname.endsWith(ext)) || 
         pathname === '/' || pathname === '/index.html';
}

// バックグラウンド同期（Progressive Enhancement）
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'sgf-save') {
    event.waitUntil(syncSGFData());
  }
});

// SGFデータの同期処理
async function syncSGFData() {
  try {
    // IndexedDBから未同期のSGFデータを取得
    const unsynced = await getUnsyncedSGFData();
    
    for (const data of unsynced) {
      // サーバーに送信（実装は環境に応じて）
      await uploadSGFData(data);
      await markAsSynced(data.id);
    }
    
    console.log('Service Worker: SGF sync completed');
  } catch (error) {
    console.error('Service Worker: SGF sync failed', error);
  }
}

// プッシュ通知処理（将来の拡張用）
self.addEventListener('push', event => {
  console.log('Service Worker: Push received');
  
  const options = {
    body: event.data ? event.data.text() : '新しい棋譜が利用可能です',
    icon: './icon-192.png',
    badge: './badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '確認する',
        icon: './action-explore.png'
      },
      {
        action: 'close',
        title: '閉じる',
        icon: './action-close.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('囲碁ビューワ - Tumego', options)
  );
});

// 通知クリック処理
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked');
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('./')
    );
  } else if (event.action === 'close') {
    // 何もしない（通知を閉じるだけ）
  } else {
    // デフォルトアクション
    event.waitUntil(
      clients.openWindow('./')
    );
  }
});

// メッセージ処理（アプリからの通信）
self.addEventListener('message', event => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_SGF') {
    // SGFデータを一時的にキャッシュ
    cacheSGFData(event.data.sgf);
  }
  
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    // キャッシュサイズを返す
    getCacheSize().then(size => {
      event.ports[0].postMessage({ cacheSize: size });
    });
  }
});

// キャッシュサイズの取得
async function getCacheSize() {
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  let totalSize = 0;
  
  for (const request of requests) {
    const response = await cache.match(request);
    if (response && response.headers.get('content-length')) {
      totalSize += parseInt(response.headers.get('content-length'));
    }
  }
  
  return totalSize;
}

// SGFデータの一時キャッシュ
async function cacheSGFData(sgfData) {
  try {
    const cache = await caches.open(`${CACHE_NAME}-sgf`);
    const response = new Response(sgfData, {
      headers: {
        'Content-Type': 'application/x-go-sgf',
        'Cache-Control': 'max-age=86400' // 24時間
      }
    });
    
    await cache.put(`/temp-sgf-${Date.now()}`, response);
    console.log('Service Worker: SGF data cached temporarily');
  } catch (error) {
    console.error('Service Worker: Failed to cache SGF data', error);
  }
}

// エラーハンドリング
self.addEventListener('error', event => {
  console.error('Service Worker: Error occurred', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('Service Worker: Unhandled promise rejection', event.reason);
});

// 定期的なキャッシュクリーンアップ（24時間ごと）
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24時間

setInterval(async () => {
  try {
    const cacheNames = await caches.keys();
    const now = Date.now();
    
    for (const cacheName of cacheNames) {
      if (cacheName.includes('-sgf')) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const request of requests) {
          const response = await cache.match(request);
          const cacheTime = response.headers.get('date');
          
          if (cacheTime && (now - new Date(cacheTime).getTime()) > CLEANUP_INTERVAL) {
            await cache.delete(request);
            console.log('Service Worker: Cleaned up old SGF cache', request.url);
          }
        }
      }
    }
  } catch (error) {
    console.error('Service Worker: Cache cleanup failed', error);
  }
}, CLEANUP_INTERVAL);

// iOS Safari向けの特別な処理
if (navigator.userAgent.includes('Safari') && navigator.userAgent.includes('Mobile')) {
  console.log('Service Worker: iOS Safari detected, applying optimizations');
  
  // iOS向けのキャッシュ戦略を調整
  self.addEventListener('fetch', event => {
    if (event.request.destination === 'document' && 
        event.request.mode === 'navigate') {
      
      // iOS Safariでのナビゲーション時の特別処理
      event.respondWith(
        caches.match(event.request)
          .then(response => response || fetch(event.request))
          .catch(() => caches.match('./index.html'))
      );
    }
  });
}

console.log('Service Worker: Script loaded successfully');