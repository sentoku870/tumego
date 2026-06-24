# AGENTS.md - tumego (詰碁Web版)

> このファイルは opencode / その他のAI開発支援ツール向けの入口ドキュメントです。
> プロジェクトの中心ドキュメントは **CLAUDE.md と .claude/rules/** です。
> AGENTS.md はそれらへの参照と、AI向けのビルド/テスト手順を簡潔にまとめたものです。

---

## 1. プロジェクト概要

- **名称**: tumego（詰碁Web版）
- **目的**: Webブラウザで動く「詰碁・局面の編集＋解答＋共有」軽量ツール
- **公開URL**: https://sentoku870.github.io/tumego/
- **リポジトリ**: sentoku870/tumego
- **技術スタック**: TypeScript / HTML / CSS（Jest, tsc）

---

## 2. 必読ドキュメント（参照順序）

1. **CLAUDE.md** ← 中心ドキュメント（必読）
2. **.claude/rules/** ← 詳細ルール
   - `01-correction-levels.md` - 修正レベル定義（Lv0-5）
   - `02-git-workflow.md` - Git/GitHub 運用
   - `03-debug-workflow.md` - デバッグ手順
   - `04-go-domain.md` - 囲碁ドメイン（棋力・解説レベル）
3. **docs/** ← 公式ドキュメント
   - `00-purpose-and-scope.md` - 目的とスコープ（fixed）
   - `02-code-structure.md` - コード構造
   - `10-branch-strategy.md` - ブランチ戦略
   - `11-release-flow.md` - リリースフロー
   - `12-dist-handling.md` - dist/ の扱い
   - `20-codex-rules.md` - AI 開発支援ルール
   - `30-roadmap.md` - ロードマップ
   - `33-worklog.md` - 作業ログ
   - `34-reference-materials.md` - 外部参考資料

---

## 3. よく使うコマンド

```bash
npm run dev    # tsc --watch（開発・型チェック）
npm run build  # tsc（ビルド、dist/ に出力）
npm test       # npm run build && jest
```

---

## 4. 現在の状態（2025-12-30 時点）

- **ver2**: 完了（基本機能が動く安定版）
- **ver3**: **デバッグ一時停止中**（PC版・教育機能の土台を優先）
- **再開目安**: PC版 Phase 1-2 が一段落したタイミング
- **公開ブランチ**: `stable-20251116`（GitHub Pages はここから）
- **開発ブランチ**: `main`（feature ブランチからPRでマージ）

---

## 5. ユーザー特性（sentoku870）

| 領域 | レベル |
|------|--------|
| PC操作 | 中〜上級 |
| プログラミング | 初心者（コードは読めるが書けない） |
| Git/GitHub | 基本操作可（手順通りなら可） |
| 囲碁 | 野狐4-5段 |

→ **コード変更はAI主導**、手順はコピペ完結で提示、確認ポイントを明示する。

---

## 6. 重要ルール（要約）

1. 修正前に **Lv0〜5** を判定する（`.claude/rules/01-correction-levels.md`）
2. **code-change** は `feature/YYYY-MM-DD-<short-desc>` ブランチ + PR
3. **docs-only**（`docs/**/*.md`, README, CHANGELOG 等）は main 直コミット可
4. `dist/` は **リリース時のみ** 触る
5. `stable-20251116` には直接コミットしない
6. GitHub Pages の公開設定は変更しない
7. 詳細ルールは `.claude/rules/` を参照
8. **Claude Code 固有のローカル設定**（`.claude/settings.local.json` 等）は commit 対象外。`.gitignore` で除外済み

---

## 7. コード構造（要旨）

- `src/main.ts` - エントリーポイント
- `src/state/game-store.ts` - 状態管理の中心
- `src/services/` - SGF / preferences / board-capture
- `src/ui/controllers/` - UI コントローラ群
- `src/go-engine.ts`, `src/history-manager.ts`, `src/renderer.ts` 等
- `tests/` - Jest テスト
- `dist/` - ビルド成果物（GitHub Pages 公開用、リリース時のみ更新）

---

## 8. AIが守るべきこと

- ユーザーが **1人で動作ロジック修正をしない**よう、手順と確認をセットにする
- 専門用語は **初出時に1〜2文で定義** する
- コピペで完結する **具体的なコマンド** を提示する
- 複数ファイルの一括変更は避け、**段階的** に進める
- 推測で判断せず、**必ずユーザーに確認** する
- **Git 操作（commit / push / PR 作成 等）は AI が実施する**。ただし **重要操作の前には必ず確認** を取り、`force push` 等の破壊的操作は **絶対に行わない**

---

## 9. 変更履歴

- 2025-12-30: 初版作成（opencode 移行対応、CLAUDE.md への参照を主とする）
