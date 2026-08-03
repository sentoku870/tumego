// ============ types/ 統合再エクスポート ============
// 後方互換のため、`from './types.js'` の既存 import を維持する。
// 新規コードは直接 `from './types/<category>.js'` を推奨。

export * from './domain.js';
export * from './state.js';
export * from './sgf.js';
export * from './render.js';
export * from './config.js';
