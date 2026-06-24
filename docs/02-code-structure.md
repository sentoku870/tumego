# tumego コード構造

> 最終更新: 2025-12-30
> 詳細は実際のソースコードを参照してください。

---

## 1. ディレクトリ構造

```
tumego/
├── src/
│   ├── index.ts              # エントリーポイント
│   │
│   ├── core/                 # コアロジック
│   │   ├── GameStore.ts       # 状態管理（中心）
│   │   ├── History.ts         # 履歴管理（Undo/Redo）
│   │   ├── SGFParser.ts       # SGF読み込み・書き出し
│   │   └── Board.ts           # 盤面ロジック
│   │
│   ├── ui/                   # UI層
│   │   ├── BoardView.ts       # 盤面表示
│   │   ├── Toolbar.ts         # ツールバー
│   │   ├── Preferences.ts     # 設定画面
│   │   └── ShareDialog.ts     # 共有ダイアログ
│   │
│   └── utils/                # ユーティリティ
│       ├── coords.ts          # 座標変換
│       └── storage.ts         # localStorage操作
│
├── dist/                     # ビルド成果物（GitHub Pages用）
├── docs/                     # ドキュメント
├── package.json
├── tsconfig.json
└── vite.config.ts            # ビルド設定（Vite使用の場合）
```

---

## 2. 主要クラスの関係

```
index.ts（エントリーポイント）
├── GameStore（状態管理）
│   ├── currentMode      ← edit / solve / view
│   ├── board            ← 盤面状態
│   ├── history          ← History インスタンス
│   └── sgfData          ← SGF情報
│
├── BoardView（盤面表示）
│   └── GameStore を参照して描画
│
├── Toolbar（ツールバー）
│   └── GameStore のメソッドを呼び出し
│
└── Preferences（設定）
    └── localStorage 経由で保存
```

### 依存方向
```
UI層（BoardView, Toolbar）
    ↓ 参照
コア層（GameStore, History, Board）
    ↓ 使用
ユーティリティ（coords, storage）
```

---

## 3. 状態管理（GameStore）

### 3.1 主要な状態

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `currentMode` | `'edit' \| 'solve' \| 'view'` | 現在のモード |
| `board` | `Board` | 盤面状態（石の配置） |
| `history` | `History` | 操作履歴 |
| `sgfData` | `SGFData` | SGF情報 |
| `problemBoard` | `Board \| null` | 問題図（solve時） |

### 3.2 主要なメソッド

| メソッド | 説明 |
|----------|------|
| `placeStone(x, y)` | 石を置く |
| `undo()` | 元に戻す |
| `redo()` | やり直す |
| `setMode(mode)` | モード切替 |
| `loadSGF(sgf)` | SGF読み込み |
| `exportSGF()` | SGF出力 |

---

## 4. モード別の動作

### 4.1 edit モード
- 石の連続配置が可能
- 黒白の切替がスムーズ
- 囲碁ルールON/OFF切替可能

### 4.2 solve モード
- 問題図が固定される
- 解答シーケンスを記録
- 共有機能が有効

### 4.3 view モード
- SGFの再生専用
- 石の配置は不可
- 特定局面を問題図化できる

---

## 5. データフロー

### 5.1 石を置く場合
```
1. ユーザーが盤面をクリック
     ↓
2. BoardView.onClick(x, y)
     ↓
3. GameStore.placeStone(x, y)
     ↓ 状態更新
4. History.push(action)
     ↓
5. BoardView.render()（再描画）
```

### 5.2 SGF読み込みの場合
```
1. ユーザーがファイル選択/テキスト貼り付け
     ↓
2. SGFParser.parse(sgfText)
     ↓
3. GameStore.loadSGF(parsed)
     ↓ 状態更新
4. BoardView.render()
```

---

## 6. 履歴管理（History）

### 6.1 基本構造
```typescript
class History {
  private stack: Action[];
  private pointer: number;
  
  push(action: Action): void;
  undo(): Action | null;
  redo(): Action | null;
  canUndo(): boolean;
  canRedo(): boolean;
}
```

### 6.2 Action の種類
| Action | 説明 |
|--------|------|
| `PlaceStone` | 石を置く |
| `RemoveStone` | 石を取り除く |
| `SetMode` | モード変更 |
| `LoadSGF` | SGF読み込み |

---

## 7. SGF処理

### 7.1 SGFParser
- SGFテキスト → 内部データ構造
- 最小限のプロパティのみ対応

### 7.2 対応プロパティ
| プロパティ | 説明 |
|-----------|------|
| `SZ` | 盤サイズ |
| `PB` / `PW` | 黒番/白番の名前 |
| `DT` | 日付 |
| `AB` / `AW` | 初期配置（黒/白） |
| `B` / `W` | 着手（黒/白） |
| `C` | コメント |

---

## 8. ビルドと実行

### 8.1 開発サーバー
```powershell
cd D:\github\tumego
npm run dev
# ブラウザで http://localhost:xxxx を開く
```

### 8.2 ビルド
```powershell
npm run build
# dist/ にビルド成果物が生成される
```

### 8.3 デプロイ（GitHub Pages）
```powershell
npx gh-pages -d dist
# または手動で gh-pages ブランチにプッシュ
```

---

## 9. 変更時の注意点

### 9.1 状態管理を触る場合
- `GameStore.ts` が中心
- `History.ts` との整合性に注意
- モード切替の影響範囲を確認

### 9.2 UIを触る場合
- `BoardView.ts` は描画のみ
- イベントハンドラ → GameStore のメソッド呼び出し
- レスポンシブ対応を忘れずに

### 9.3 SGF処理を触る場合
- originalSGF は上書きしない原則
- 問題図用/解答用は別枠で管理

---

## 10. 変更履歴

- 2025-12-30: v1.0 作成（Claude Code移行対応）
- 2025-12-30: v1.1 Claude Code 関連ドキュメント整理（履歴追記）
