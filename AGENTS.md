# AGENTS.md - tumego (詰碁Web版)

> このファイルは AI 開発支援ツール（opencode / Claude / Codex 等）向けの入口ドキュメントです。
> AGENTS.md は AI がプロジェクト理解・修正を行うために**自己完結**しています。
> 公式の仕様・運用ルールは `docs/` を参照してください。

---

## 1. プロジェクト概要

### 1.1 基本情報
- **名称**: tumego（詰碁Web版）
- **目的**: Webブラウザ上で動く「詰碁・局面の編集＋解答＋共有」に特化した軽量ツール
- **公開URL**: https://sentoku870.github.io/tumego/
- **リポジトリ**: `sentoku870/tumego`
- **技術スタック**: TypeScript / HTML / CSS（Jest, tsc）

### 1.2 現在の状態（2025-12-30 時点）
- **ver2**: 完了（基本機能が動く安定版）
- **ver3**: **デバッグ一時停止中**（PC版・教育機能の土台を優先）
- **再開目安**: PC版 Phase 1-2 が一段落したタイミング
- **公開ブランチ**: `stable-20251116`（GitHub Pages はここから）
- **開発ブランチ**: `main`（feature ブランチからPRでマージ）

詳細は `docs/30-roadmap.md` を参照。

---

## 2. よく使うコマンド

```bash
npm run dev    # tsc --watch（開発・型チェック）
npm run build  # tsc（ビルド、dist/ に出力）
npm test       # npm run build && jest
```

---

## 3. 公式ドキュメント（`docs/`）

| ファイル | 用途 |
|---|---|
| `docs/00-purpose-and-scope.md` | 目的とスコープ（やること／やらないこと） |
| `docs/02-code-structure.md` | コード構造 |
| `docs/10-branch-strategy.md` | ブランチ運用ポリシー |
| `docs/11-release-flow.md` | リリース手順（stable ブランチと dist の更新） |
| `docs/12-dist-handling.md` | dist/ ディレクトリの扱い |
| `docs/30-roadmap.md` | バージョンロードマップ（ver2-6） |
| `docs/33-worklog.md` | 作業ログ |
| `docs/34-reference-materials.md` | 外部参考資料の整理 |
| `docs/README.md` | 公式ドキュメント案内 |

---

## 4. コード構造（要旨）

```
tumego/
├── src/
│   ├── main.ts                       ← エントリーポイント
│   ├── go-engine.ts                  ← 囲碁ロジック
│   ├── history-manager.ts            ← 履歴管理
│   ├── renderer.ts                   ← 描画
│   ├── sgf-parser.ts                 ← SGF パース
│   ├── qr-manager.ts                 ← QR コード
│   ├── ui-controller.ts
│   ├── types.ts
│   ├── app/                          ← アプリケーション基盤
│   │   ├── composition-root.ts
│   │   ├── event-bus.ts
│   │   └── debug-api.ts
│   ├── state/                        ← 状態管理
│   │   ├── game-store.ts             ← 状態管理の中心
│   │   ├── board-cache-manager.ts
│   │   ├── mode-operations.ts
│   │   ├── handicap-setter.ts
│   │   └── performance-monitor.ts
│   ├── services/                     ← サービス層
│   │   ├── sgf-io.ts
│   │   ├── sgf-service.ts
│   │   ├── sgf-share.ts
│   │   ├── preferences-store.ts
│   │   └── board-capture-service.ts
│   └── ui/controllers/
│       └── board-input-state-machine.ts
├── tests/                            ← Jest テスト
├── dist/                             ← ビルド成果物（GitHub Pages 公開用、リリース時のみ更新）
├── docs/                             ← 公式ドキュメント
├── packages/                         ← 関連パッケージ
├── index.html
├── board.css / layout.css
└── package.json
```

### 主な状態管理
```
GameStore
├── currentMode    ← edit / solve / view
├── board          ← 盤面状態
├── history        ← 操作履歴
└── sgfData        ← SGF情報
```

---

## 5. ユーザー特性（sentoku870）

| 領域 | レベル |
|---|---|
| PC操作 | 中〜上級 |
| プログラミング | 初心者（コードは読めるが書けない） |
| Git/GitHub | 基本操作可（手順通りなら可） |
| 囲碁 | 野狐4-5段 |

→ **コード変更はAI主導**、手順はコピペ完結で提示、確認ポイントを明示する。

---

## 6. 修正レベル（Lv0-5）

修正前に必ずレベルを判定し、適切なフローを選択する。迷ったら上のレベルに寄せる（安全側）。

| Lv | 規模 | 対応方法 |
|:--:|---|---|
| 0 | 超軽微（文言/定数だけ） | 直接修正 |
| 1 | 軽微（〜50行、1ファイル内の小さな修正/スタイル調整） | 直接修正 |
| 2 | 中程度（1ファイル内で機能変更/追加） | Plan Mode → 承認 → 実行 |
| 3 | 複数ファイル（2-3ファイル、UI＋ロジック） | Plan Mode + 段階的実行 |
| 4 | 大規模（3ファイル超、構造/状態管理レベル変更） | 分割案を先に提示 |
| 5 | 根本変更（設計全体の見直し） | 設計相談のみ（実装保留） |

### docs-only / code-change の境界

- **docs-only**（`docs/**/*.md`, README, CHANGELOG 等）→ **main 直接コミット可**
- **code-change**（`src/**/*.ts`, `*.css`, `*.html`, `package.json`, 設定ファイル、`dist/` への影響がある変更）→ **feature ブランチ + PR 必須**
- 迷ったら **code-change（安全側）** として扱う

### 典型的な判断例
- CSS の色・サイズ調整: Lv0-1
- ボタンのテキスト変更: Lv0
- イベントハンドラのロジック修正: Lv1-2
- GameStore + BoardView の連動修正: Lv3
- モード切替（edit/solve/view）の仕様変更: Lv3-4
- SGF パーサーの全面刷新: Lv4-5

---

## 7. Git ワークフロー（要約）

### 7.1 ブランチの役割

| ブランチ | 用途 | 直接コミット |
|---|---|:---:|
| `main` | 開発の基準ブランチ | docs-only のみ可 |
| `stable-20251116` | 最新安定版（GitHub Pages 公開元） | **禁止** |
| `gh-pages` | GitHub Pages 公開用 | dist/ のみ |
| `feature/YYYY-MM-DD-<short-desc>` | code-change 用 | ○ |

### 7.2 code-change フロー
1. `git switch main` → `git pull origin main`
2. `git switch -c feature/YYYY-MM-DD-<short-desc>`
3. 修正を実施
4. `git status` / `git diff` で差分確認
5. `npm run dev` でローカル動作確認 → DevTools でコンソールエラー確認
6. `npm run build` でビルド確認
7. `git add -A` → `git commit -m "<type>: <short-desc>"`
8. `git push -u origin HEAD`
9. `gh pr create --base main --fill`

### 7.3 docs-only フロー
1. `git switch main` → `git pull`
2. ドキュメントを修正
3. `git add -A` → `git commit -m "docs: <short-desc>"` → `git push`

### 7.4 コミットメッセージ規約
| type | 用途 |
|---|---|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `refactor` | リファクタリング |
| `docs` | ドキュメント |
| `style` | フォーマット/CSS |
| `chore` | その他 |

詳細は `docs/10-branch-strategy.md` / `docs/11-release-flow.md` / `docs/12-dist-handling.md` を参照。

### 7.5 やってはいけないこと
- `stable-20251116` への直接 push
- `force push`（明示的指示がない限り）
- GitHub Pages の公開設定変更
- 開発ブランチ（`feature/*`）で `dist/` を触ること

---

## 8. デバッグ手順（要約）

### 8.1 デバッグサイクル
1. **現象の整理**: いつ／どの画面・モード（edit/solve/view）／何が起きた／期待していた動作
2. **再現手順の確定**: 番号付きリストで明文化
3. **情報収集**: DevTools の Console エラー、Network、スクリーンショット、デバイス情報
4. **原因候補の整理**: 状態管理／UI イベント／レスポンシブ等の候補を表に
5. **修正レベル判定**: §6 に基づき Lv を決定
6. **修正と確認**: 修正 → `npm run dev` → 再現手順で確認 → PC/スマホ両方で確認
7. **引継ぎメモ作成（任意）**: 詳細は `docs/33-worklog.md` へ

### 8.2 Web版固有のよくある問題
| 症状 | 原因候補 | 確認方法 |
|---|---|---|
| 画面が真っ白 | JS エラー | DevTools Console |
| ボタンが反応しない | イベントハンドラ | Console ログ |
| 石が置けない | GameStore 状態 | 状態ログ出力 |
| スマホで表示崩れ | CSS / レスポンシブ | 別デバイスで確認 |
| localStorage 関連 | 保存/読込エラー | Application タブ |

---

## 9. 囲碁ドメイン

### 9.1 棋力レベル定義（G0-G4）
- ユーザー本人の棋力は **野狐4-5段（G4相当）** を想定
- ただし、このアプリの対象ユーザーは **級位者〜初段（G0-G2）** が中心

| ラベル | 目安棋力 | 特徴 |
|:---:|---|---|
| G0 | 〜10級 | ルール〜基本死活。対局経験少なめ |
| G1 | 5〜1級 | 一般アマ級位者。布石・定石は一部のみ |
| G2 | 初段〜二段 | 基本形理解あり。読み抜け・手筋抜けあり |
| G3 | 三〜四段 | 戦い強いがムラあり。ヨセに取りこぼし |
| G4 | 五段相当 | ユーザー本人。1-2分野に明確な弱点 |

### 9.2 解説レベル（A-D）
- **提供対象**: A / B のみ
- **対象外**: C / D（プロ・高段者向けの詳細解析）

| ラベル | 概要 | 具体例 |
|:---:|---|---|
| A | 方向性ヒント | 「まず隅の石を助けましょう」 |
| B | 役割・構図ヒント | 「隅の黒2子を捨てると、外側の厚みが活きます」 |
| C | プロ構想レベル | 複数手先の構想と変化を文章で説明（重い） |
| D | AI解析レベル | あらゆる変化を網羅（非現実的、基本不採用） |

### 9.3 学習・解説コンセプト
- **主対象**: 級位者〜初段（G0-G2）
- **目的**: パターン認識の強化（読みは補助的）
- **スタイル**: NHK解説風のワンポイントコメント

---

## 10. アプリの役割と制約

### 10.1 このアプリがやること
- **編集モード（edit）**: 石の連続配置、局面作成
- **解答モード（solve）**: 問題図の固定、解答シーケンス記録
- **閲覧モード（view）**: SGF 再生、特定局面の問題図化
- **共有**: 番号付き画像、URL/QRコード
- **野狐スクショ→問題図**のワークフロー簡略化

### 10.2 やらないこと（non-goals）
- 大規模な棋譜管理（フォルダ/タグ/検索）
- 複雑な変化図ツリー編集
- AIエンジン連携・勝率グラフ等の解析
- 印刷用レイアウト
- 多数のキーボードショートカット

### 10.3 役割分担の原則
- **本格検討・AI解析**: KaTrain / Lizzie / Sabaki に任せる
- **このアプリ**: 「軽い編集・解答・共有」「スクショ→問題図」に集中

---

## 11. 重要ルール（要約）

1. 修正前に **Lv0〜5** を判定する（§6）
2. **code-change** は `feature/YYYY-MM-DD-<short-desc>` ブランチ + PR
3. **docs-only**（`docs/**/*.md`, README, CHANGELOG 等）は main 直コミット可
4. `dist/` は **リリース時のみ** 触る
5. `stable-20251116` には直接コミットしない
6. GitHub Pages の公開設定は変更しない
7. AI ツール固有のローカル設定（`.tool-xxx/settings.local.json` 等）は commit 対象外。`.gitignore` で除外する

---

## 12. AI が守るべきこと

- ユーザーが **1人で動作ロジック修正をしない**よう、手順と確認をセットにする
- 専門用語は **初出時に1〜2文で定義** する
- コピペで完結する **具体的なコマンド** を提示する
- 複数ファイルの一括変更は避け、**段階的** に進める
- 推測で判断せず、**必ずユーザーに確認** する
- **Git 操作（commit / push / PR 作成 等）は AI が実施する**。ただし **重要操作の前には必ず確認** を取り、`force push` 等の破壊的操作は **絶対に行わない**

---

## 13. 変更履歴

- 2025-12-30: 初版作成（opencode 移行対応、CLAUDE.md への参照を主とする）
- 2025-12-30: 自己完結化。CLAUDE.md / .claude/ / docs/20-codex-rules.md を削除し、本ファイルに内容を吸収
