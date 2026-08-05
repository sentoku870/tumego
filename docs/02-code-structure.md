# tumego コード構造

> 最終更新: 2026-08-05
> 詳細は実際のソースコードを参照してください。

---

## 1. ディレクトリ構造（2026-08-05 時点）

```
tumego/
├── src/
│   ├── main.ts                       # エントリーポイント (DOMContentLoaded → initializeApp)
│   ├── ui-controller.ts              # 上位 UI 制御（initialize, preferences 適用, resize イベント）
│   ├── go-engine.ts                  # 囲碁ルールエンジン（着手・捕獲・コウ判定）
│   ├── history-manager.ts            # 履歴スナップショット管理（最大 5 件）
│   ├── sgf-parser.ts                 # SGF テキスト ⇄ 内部データ構造
│   ├── sgf-coordinates.ts            # 座標 ⇄ 'aa'〜'ss'
│   ├── sgf-metadata.ts               # GN/SZ/KM/HA/PB/PW/RE/PL 抽出
│   ├── qr-manager.ts                 # QR / Discord 共有ポップアップ（Modal 使用）
│   ├── types.ts                      # 共通型 re-export（後方互換）
│   │
│   ├── types/                        # 型定義
│   │   ├── domain.ts                 # GameState / Move / Position など
│   │   ├── state.ts                  # Preferences / HistorySnapshot
│   │   ├── sgf.ts                    # SGFGameInfo（SGFNode / GameTree は 2026-08-03 に削除）
│   │   ├── render.ts                 # 描画モデル型
│   │   ├── config.ts                 # DEFAULT_CONFIG (座標オフセット, 閾値)
│   │   └── index.ts                  # 集約 re-export
│   │
│   ├── app/                          # アプリケーション基盤
│   │   ├── app-factory.ts            # DI: サービス・コントローラの生成と接続
│   │   ├── composition-root.ts       # 後方互換 re-export
│   │   ├── debug-api.ts              # DevTools 向け window.tumego API
│   │   ├── event-bus.ts              # UIUpdate / AnswerButtonUpdate / EraseModeDisable / SgfApplied
│   │   └── ui-update-coordinator.ts  # UIUpdate 購読者集約
│   │
│   ├── state/                        # 状態管理
│   │   ├── game-store.ts             # Facade（外部向け公開 API のみ）
│   │   ├── board-cache-manager.ts    # 盤面タイムラインのキャッシュと再構築
│   │   ├── mode-operations.ts        # 編集⇄解答モード遷移, SGF 読込時の状態書込
│   │   ├── mode-controller.ts        # モード遷移の共通ヘルパ
│   │   ├── handicap-setter.ts        # 置石配置（even / no-komi / fixed の 3 モード）
│   │   ├── marker-store.ts           # ○△□× ラベルの配置・トグル・永続化
│   │   ├── game-info-store.ts        # PB/PW/KM/RE/タイトル管理
│   │   ├── board-utils.ts            # 共通: createEmptyBoard, cloneBoard, isValidPosition, hasGameData
│   │   └── performance-monitor.ts    # 盤面再構築処理のプロファイリング
│   │
│   ├── services/                     # サービス層
│   │   ├── sgf-service.ts            # SGF 適用 / 書き出し（ModeOperations 経由）
│   │   ├── sgf-io.ts                 # ファイル・クリップボード I/O
│   │   ├── sgf-share.ts              # URL/Base64 共有（createShareURL, compress, etc.）
│   │   ├── board-capture-service.ts  # SVG → PNG → クリップボード/プレビュー（Modal 使用）
│   │   ├── preferences-store.ts      # 設定永続化 (localStorage, 旧 'on'/'off' 値もマイグレーション)
│   │   ├── render-snapshot.ts        # 描画スナップショット interface
│   │   └── share/
│   │       └── share-modal.ts        # 共有方法選択モーダル（qr-manager から分離）
│   │
│   ├── renderer/                     # 描画
│   │   ├── view-model.ts             # 純粋: GameState/Preferences → 中間オブジェクト
│   │   ├── renderer.ts               # DOM 描画（SVG） Facade
│   │   ├── renderer-snapshot.ts      # 撮影用 render() ヘルパ
│   │   └── drawers/
│   │       ├── svg-helpers.ts        # SVG 要素生成ユーティリティ
│   │       ├── board-drawer.ts       # グリッド + 星
│   │       ├── coordinates-drawer.ts # A-T, 1-19 ラベル
│   │       ├── stones-drawer.ts      # 黒白石 + 着手番号
│   │       ├── highlight-drawer.ts   # 直前手赤枠
│   │       └── markers-drawer.ts     # ○△□×/ラベル (CR/TR/SQ/MA/LB)
│   │
│   ├── ui/                           # UI 層
│   │   ├── state/
│   │   │   └── ui-interaction-state.ts  # ドラッグ状態, ボードフォーカス等
│   │   ├── utils/
│   │   │   └── pointer-utils.ts        # isPointerActive 判定
│   │   ├── views/                     # ビュー（DOM 構造組み立て）
│   │   │   ├── modal.ts                # 共通モーダル (a11y: role=dialog, Esc で閉じる)
│   │   │   └── history-view.ts         # 履歴ダイアログ（Modal 使用）
│   │   └── controllers/                # 各種 UI コントローラ
│   │       ├── board-interaction-controller.ts  # ポインタ入力統合 Facade
│   │       ├── board-input-state-machine.ts      # pointer decision 状態機械
│   │       ├── board/
│   │       │   ├── board-pointer-handler.ts       # 盤面ポインタイベント
│   │       │   └── board-position.ts              # 座標変換
│   │       ├── long-press-detector.ts             # 長押し検出
│   │       ├── pointer-input.ts                   # ポインタイベント正規化
│   │       ├── dropdown-manager.ts                # ポップオーバーポジション制御
│   │       ├── toolbar-controller.ts              # ツールバー Facade
│   │       ├── toolbar-buttons.ts                 # 11 ボタンのバインド
│   │       ├── toolbar/
│   │       │   ├── toolbar-state.ts               # ボタンの有効/無効・表示制御
│   │       │   └── toolbar-marker-palette.ts      # マーカーパレット
│   │       ├── file-menu-controller.ts            # ファイル/ヘッダメニュー
│   │       ├── file-menu/
│   │       │   └── header-editor.ts               # SGF ヘッダ編集
│   │       ├── feature-menu-controller.ts         # 機能メニュー（置石ダイアログは Modal 使用）
│   │       ├── feature-menu/
│   │       │   ├── answer-copy.ts                 # 解答コピー
│   │       │   └── handicap-dialog.ts             # 置石ダイアログ
│   │       └── settings-controller.ts             # 設定パネル
│
├── dist/                       # ビルド成果物（GitHub Pages 用、リリース時のみ更新）
├── docs/                       # ドキュメント
├── tests/                      # Jest テスト
├── packages/                   # ローカルパッケージ（ローカル Jest ランナー等）
└── index.html                  # エントリ HTML
```

---

## 2. 主要クラスの関係

```
main.ts（エントリ）
└── initializeApp()
    ├── compositionRoot()           → AppContext を生成
    │   ├── GameStore（Facade）
    │   │   ├── BoardCacheManager
    │   │   ├── ModeOperations ──→ HandicapSetter
    │   │   │                  ──→ MarkerStore
    │   │   │                  ──→ GameInfoStore
    │   │   │                  ──→ ModeController
    │   │   ├── HandicapSetter
    │   │   ├── MarkerStore
    │   │   ├── GameInfoStore
    │   │   ├── PerformanceMonitor
    │   │   └── BoardUtils
    │   ├── Renderer ──→ ViewModelBuilder（純粋）
    │   │          ──→ BoardDrawer / CoordinatesDrawer / StonesDrawer
    │   │          ──→ HighlightDrawer / MarkersDrawer
    │   ├── SGFService ──→ SGFParser
    │   │             ──→ SGFIO
    │   │             ──→ SGFShare
    │   ├── QRManager ──→ ShareModal
    │   ├── BoardCaptureService ──→ Modal（プレビュー）
    │   ├── ToolbarController ──→ ToolbarButtons + ToolbarState + MarkerPalette
    │   ├── FeatureMenuController ──→ HandicapDialog + AnswerCopy
    │   ├── FileMenuController ──→ HeaderEditor
    │   ├── SettingsController
    │   ├── BoardInteractionController ──→ BoardPointerHandler
    │   │                            ──→ BoardInputStateMachine
    │   │                            ──→ LongPressDetector
    │   └── EventBus
    └── UIController.initialize()
        └── 各 controller.initialize()
        └── preferences.onChange → eventBus.emitUIUpdate
        └── SGF 自動ロード（URL ?sgf=...）
```

### 依存方向

```
app/      ──→ state/, services/, ui/, renderer/, types/
ui/       ──→ state/, services/, renderer/, types/
services/ ──→ state/, types/
state/    ──→ types/, go-engine, history-manager
renderer/ ──→ state/, ui/state, types/
core (go-engine, history-manager, sgf-*) ──→ types/, state/board-utils.ts
types/    ──→ （なし）
```

**重要**: services / ui は `state` を直接参照せず、必ず GameStore の公開メソッド経由でアクセス。

---

## 3. GameStore (Facade)

外部に対する状態書込の単一エントリポイント。内部の `modeOps` / `cache` / `handicap` / `marker` / `info` / `monitor` はすべて `private`。

### 3.1 公開 API カテゴリ

| カテゴリ | メソッド | 委譲先 |
|---------|---------|--------|
| 状態参照 | `snapshot`, `currentColor`, `historyManager`, `getGameInfo` | state |
| 着手・石操作 | `tryMove`, `removeStone`, `directPlace`, `placeWithRulesInEdit`, `directRemove`, `moveStone` | engine + state |
| 履歴復元 | `undo`, `restoreHistorySnapshot`, `setMoveIndex`, `rebuildBoardFromMoves` | history + cache |
| モード遷移 | `startNumberMode`, `setProblemDiagram`, `restoreProblemDiagram`, `enterSolveMode`, `exitSolveModeForEditing`, `resetForClearAll`, `hasProblemDiagram` | modeOps |
| 単純 setter | `setMode`, `setEraseMode`, `setStartColor`, `setAnswerMode`, `resetInteractionModes` | state |
| 置石 | `setHandicap` | handicap |
| SGF 適用 | `resetForSgfLoad`, `applySgfMeta`, `updateGameInfoFromSgf`, `setSgfMoves` | modeOps |
| 性能計測 | `setPerformanceDebugging`, `resetPerformanceMetrics`, `getPerformanceMetrics` | monitor |
| ゲーム情報 | `updateGameInfo` | info |

**編集モード**: `numberMode === false` + `mode: 'black'|'white'|'alt'`（石を直接配置・削除）
**解答モード**: `numberMode === true`（SGF 的な着手管理）
※「view モード」は AGENTS.md §4 との互換のための概念で、コード上は未実装（2026-08 時点）。

---

## 4. イベントバス

```typescript
UIEventBus
  ├── onUIUpdate / emitUIUpdate              // 描画更新
  ├── onAnswerButtonUpdate / emit…           // 解答ボタン更新
  ├── onEraseModeDisable / emit…             // 消去モード無効化
  └── onSgfApplied / emit…                   // SGF 適用通知
```

`app-factory.ts`（旧 `composition-root.ts`）の `UIUpdateCoordinator` で `onUIUpdate` に以下を接続:
```typescript
renderer.render();
renderer.updateInfo();
renderer.updateSlider();
renderer.updateCapturedStones(...);
feature.updateMenuState();
toolbar.updateToolbarState();
```

---

## 5. データフロー

### 5.1 石を置く場合
```
User clicks board
  → BoardInteractionController.handlePointerDown
  → BoardInputStateMachine → 決定 (startDrag / ignore)
  → store.tryMove(pos, color)
      → GoEngine.playMove
      → state 更新
      → BoardCacheManager.rebuildBoardFromMoves
  → eventBus.emitUIUpdate
  → Renderer.render
```

### 5.2 SGF 読み込みの場合
```
User selects file / pastes / URL
  → FileMenuController.applySgf
  → SGFService.apply
      → SGFParser.parse
      → store.resetForSgfLoad        (履歴保存 + フラグリセット)
      → store.applySgfMeta          (startColor, handicap, problemDiagram)
      → store.updateGameInfo         (PB/PW/KM/RE)
      → store.setSgfMoves            (sgfMoves 設定)
      → store.setMoveIndex           (0 or 1 手目に進める)
  → eventBus.emitUIUpdate
  → Renderer.render
```

### 5.3 モーダル表示
```
Caller (e.g. QRManager)
  → new Modal({ id, content, options }).open()
      → DOM 構築（黒半透明オーバーレイ + 白カード）
      → role=dialog, aria-modal=true
      → Esc / 背景クリックで閉じる
  → User closes
      → close() → DOM 削除, イベント解除, onClose コールバック
```

---

## 6. Modal 共通コンポーネント

`src/ui/views/modal.ts` に集約。5 箇所すべて移行済み（2026-06-24）:

| 利用元 | 用途 | modal id |
|-------|------|----------|
| `qr-manager.ts` | 共有方法選択 | `share-method-popup` |
| `qr-manager.ts` | QR コード表示 | `qr-popup` |
| `feature-menu/handicap-dialog.ts` | 置石ダイアログ | `handicap-popup` |
| `board-capture-service.ts` | 盤面プレビュー | `board-preview-overlay` |
| `history-view.ts` | 履歴ダイアログ | `history-popup` |

各利用元は `currentXxxModal: Modal | null` フィールドでモーダル参照を保持し、再表示時に前のものを `close()` してから開く。

---

## 7. テスト

```
tests/
├── helpers/                       # テストヘルパ（dom-setup.js, global-mocks.js）
├── app/                           # アプリケーション基盤
│   ├── debug-api.test.js
│   └── event-bus.test.js
├── state/                         # 状態管理
│   ├── board-cache-manager.test.js
│   ├── board-cache-manager-hit-invalidation.test.js
│   ├── board-utils.test.js
│   ├── cache-and-performance.test.js
│   ├── finalize-solve-session.test.js
│   ├── game-info.test.js
│   ├── game-store-setters.test.js
│   ├── game-store-core-consistency.test.js
│   ├── game-store.test.js
│   ├── handicap-setter.test.js
│   ├── handicap.test.js
│   ├── history-and-undo-behavior.test.js
│   ├── initialization.test.js
│   ├── markers.test.js
│   ├── mode-controller.test.js
│   ├── mode-operations-sgf.test.js
│   ├── mode-operations.test.js
│   ├── performance-monitor.test.js
│   ├── problem-diagram.test.js
│   ├── rebuild-board-from-moves.test.js
│   └── solve-mode.test.js
├── services/                      # サービス層
│   ├── board-capture-service.test.js
│   ├── preferences-store.test.js
│   ├── sgf-io.test.js
│   ├── sgf-service-validation.test.js
│   └── sgf-share.test.js
├── sgf/                           # SGF
│   ├── sgf-core-consistency.test.js
│   ├── sgf-service-extended.test.js
│   └── sgf-service.test.js
├── sgf-parser.test.js
├── sgf-header-roundtrip.test.js
├── integration-roundtrip.test.js
├── integration-roundtrip-extended.test.js
├── go-engine.test.js
├── history-manager.test.js
├── qr-manager.test.js
├── renderer.test.js
├── toolbar-controller.test.js
├── ui-controller.test.js
├── ui-interaction-state.test.js
├── board-capture-service.test.js   # 重複登録（要整理）
├── board-input-state-machine.test.js
├── composition-root.test.js
├── dropdown-manager.test.js
├── feature-menu-controller.test.js
├── file-menu-controller.test.js
├── main.test.js
├── pointer-input.test.js
├── pointer-utils.test.js
├── settings-controller.test.js
├── types-config.test.js
├── types.test.js
└── ui/
    ├── modal.test.js
    └── views/
        └── history-view.test.js
└── utils/
    ├── clipboard.test.js
    └── format.test.js
```

**規模**: `it/test` 単体テスト **約 935 ケース** + `describe` ブロック **311 個**。
合計テストブロック数 **約 1,246**（2026-08-05 時点、`tests/` 配下の 65 ファイル、14,633 行）。

---

## 8. ビルドと実行

### 8.1 開発
```bash
npm run dev   # tsc --watch
```

### 8.2 ビルド
```bash
npm run build  # tsc → dist/
```

### 8.3 テスト
```bash
npm test       # build + jest
```

### 8.4 デプロイ（GitHub Pages）
`docs/11-release-flow.md` 参照。

---

## 9. 変更時の注意点

### 9.1 状態管理を触る場合
- **必ず GameStore の公開メソッド経由**。直接 `state.*` を書かない。
- 新メソッドが必要なら GameStore にラッパーを追加する。
- `modeOps` / `cache` / `handicap` / `marker` / `info` / `monitor` は private。

### 9.2 UI を触る場合
- 新しいダイアログは `Modal` 共通コンポーネントを使う。
- インラインの「黒半透明オーバーレイ + 白カード」HTML を書かない。
- イベントリスナーは `eventBus` 経由で配線（app-factory の `UIUpdateCoordinator` で集約）。

### 9.3 SGF 処理を触る場合
- 状態書込は必ず `ModeOperations` 経由（`SGFService` から直接 `state.*` を書かない）。
- 既存の `originalSGF`（rawSGF）は上書きしない原則。

### 9.4 レンダリングを触る場合
- 純粋ロジックは `src/renderer/view-model.ts` に書く（jsdom 不要でテスト可能）。
- DOM 操作のみ `src/renderer/renderer.ts` に書く。
- 描画モデル型は `src/types/render.ts` に集約。

---

## 10. 変更履歴

- 2026-08-05: v3.0 全面更新（リファクタリング計画 PR #1）
  - ディレクトリ構造に `types/` `app/ui-update-coordinator.ts` `state/marker-store.ts` `state/game-info-store.ts` `state/mode-controller.ts` `renderer/drawers/` `ui/state/` `ui/views/` `ui/utils/` を反映
  - `composition-root.ts` → `app-factory.ts` に名称統一（旧名は後方互換 re-export として維持）
  - 依存方向図に `renderer/` を追加
  - §7 テスト規模を 654 → 約 1,246（935 ケース + 311 describe）に更新
  - GameStore Facade メソッド名 `moveStone` を追加
  - Modal 利用元を `feature-menu-controller.ts` → `feature-menu/handicap-dialog.ts` に詳細化
- 2026-06-24: v2.1 Modal 移行残り 3 箇所完了 + GameStore カプセル化回復 + ドキュメント更新
  - qr-manager.ts の 2 ポップアップ → Modal
  - feature-menu-controller.ts の置石ダイアログ → Modal
  - board-capture-service.ts のプレビューモーダル → Modal
  - `GameStore.modeOps` を `private` に戻し、SGFService はラッパー経由
- 2026-06-24: v2.0 アーキテクチャレビュー反映（9 PR 統合）
  - `src/state/board-utils.ts` 新設
  - `src/ui/views/modal.ts` 新設 + 4 箇所移行
  - `src/renderer/` 分割（view-model + renderer）
  - GameStore Facade 化（setter 9 個追加, SGF ラッパー 4 個）
  - SGFService → ModeOperations 経由化
  - 旧 `src/renderer.ts` 削除
  - `ToggleSetting` 型削除（boolean 統一）
  - `DEFAULT_CONFIG` に座標オフセット・レスポンシブ閾値追加
  - テスト 591 → 654 ケース
- 2025-12-30: v1.1 Claude Code 関連ドキュメント整理
- 2025-12-30: v1.0 作成（Claude Code 移行対応）
