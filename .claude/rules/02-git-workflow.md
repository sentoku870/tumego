# Git ワークフロー（Git Workflow）- Web版

> このファイルは tumego Web版 での Git/GitHub 運用ルールを定義します。
> Claude Code は Git 操作（commit/push/PR作成）を直接実行しません。

---

## 1. ブランチ方針

### 1.1 ブランチの役割

| ブランチ | 用途 | 直接コミット |
|----------|------|:------------:|
| `main` | 開発の基準ブランチ | docs-only のみ可 |
| `gh-pages` | GitHub Pages 公開用 | dist/ のみ |
| `feature/YYYY-MM-DD-<short-desc>` | code-change 用 | ○ |
| `docs/YYYY-MM-DD-<short-desc>` | 大改稿ドキュメント用（任意） | ○ |

### 1.2 リポジトリ情報
- **リモート**: `sentoku870/tumego`
- **ローカル**: `D:\github\tumego`
- **公開URL**: https://sentoku870.github.io/tumego/

---

## 2. code-change フロー

### 2.1 手順

```powershell
# 1) リポジトリへ移動
cd D:\github\tumego

# 2) main を最新にする
git switch main
git pull origin main

# 3) 作業ブランチを作成
git switch -c feature/2025-12-30-<short-desc>

# 4) Claude Code で修正を実行

# 5) 差分確認
git status
git diff

# 6) 動作確認
npm run dev              # ローカルサーバー起動
# ブラウザで http://localhost:xxxx を確認
# DevTools でコンソールエラーをチェック

# 7) ビルド確認
npm run build

# 8) コミット
git add -A
git commit -m "<type>: <short-desc>"

# 9) push
git push -u origin HEAD

# 10) PR 作成
gh pr create --base main --fill
```

### 2.2 コミットメッセージ例

| type | 用途 | 例 |
|------|------|-----|
| `feat` | 新機能 | `feat: add QR code generation` |
| `fix` | バグ修正 | `fix: solve mode stone placement` |
| `refactor` | リファクタリング | `refactor: extract GameStore logic` |
| `docs` | ドキュメント | `docs: update roadmap for ver3` |
| `style` | フォーマット/CSS | `style: adjust mobile layout` |
| `chore` | その他 | `chore: update dependencies` |

---

## 3. docs-only フロー（簡易コミット）

```powershell
cd D:\github\tumego
git switch main
git pull

# ドキュメントを修正

git add -A
git commit -m "docs: <short-desc>"
git push
```

---

## 4. デプロイフロー（GitHub Pages）

### 4.1 ビルド & デプロイ

```powershell
# 1) main で最新のビルド
git switch main
git pull
npm run build

# 2) gh-pages ブランチに dist/ をプッシュ
# 方法A: gh-pages パッケージを使う場合
npx gh-pages -d dist

# 方法B: 手動の場合
git switch gh-pages
# dist/ の内容をコピー
git add -A
git commit -m "deploy: update gh-pages"
git push origin gh-pages
git switch main
```

### 4.2 確認
- https://sentoku870.github.io/tumego/ で動作確認
- キャッシュがある場合は強制リロード（Ctrl+Shift+R）

---

## 5. PR 操作（gh コマンド）

### 5.1 初回設定（1回だけ）
```powershell
gh auth login
gh auth setup-git
gh repo set-default sentoku870/tumego
```

### 5.2 PR 作成
```powershell
gh pr create --base main --fill
```

### 5.3 PR 確認・マージ
```powershell
gh pr view <number>
gh pr checks <number>
gh pr merge <number> --merge --delete-branch
```

---

## 6. トラブル時の対処

### 6.1 変更を元に戻したい（未コミット）
```powershell
git restore .
```

### 6.2 node_modules の問題
```powershell
rm -r node_modules
npm install
```

### 6.3 dist/ が古い
```powershell
rm -r dist
npm run build
```

---

## 7. AI（Claude Code / opencode）の役割

### AI がやること
- ファイルの編集
- 差分の説明
- 次のコマンドの提示
- **Git 操作**（`git add`, `git commit`, `git push`, `gh pr create` 等）
  - **重要操作（main 直 push, PR 作成, force push 等）の前に必ずユーザー確認を取る**
  - `force push` 等の破壊的操作は **絶対に行わない**
- `npm run build`（ビルドスクリプトの実行）

### AI がやらないこと（ユーザー判断に委ねる）
- `force push`（明示的に指示されない限り禁止）
- `stable-20251116` ブランチへの直接 push
- GitHub Pages の公開設定変更
- リリース時の `dist/` の本番反映判断

---

## 8. 変更履歴

- 2025-12-30: v1.0 作成（Claude Code移行対応）
