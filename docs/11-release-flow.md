# 11 – リリースフロー（stable ブランチと dist 更新）

## 1. 前提

- GitHub Pages は `stable-20251116 / (root)` から公開されている
- 公開用ブランチ `stable-20251116` は、常に「直近の安定版」を指す
- リリース作業は必ず `main` ブランチを起点に行う
- `dist/` ディレクトリは `.gitignore` されておらず、リリース時にのみ更新する
- 通常開発では `stable-20251116` に直接コミットしない

## 2. リリース手順チェックリスト

1. **main を最新にする**
   ```pwsh
   git checkout main
   git pull
````

2. **テストとビルド前確認**

   * ローカルでアプリを起動し、最低限の動作確認を行う
   * 自動テストがある場合はすべて通す

3. **バージョン番号の更新（必要な場合）**

   * `package.json` などのバージョン情報を更新し、コミットしておく

4. **本番ビルドと dist コミット**

   ```pwsh
   npm install
   npm run build
   git status
   git add dist
   git commit -m "build: release YYYYMMDD or vX.Y.Z"
   ```

5. **main を push（リモートを最新化）**

   ```pwsh
   git push
   ```

6. **stable ブランチへの反映**

   ```pwsh
   git checkout stable-20251116
   git reset --hard main
   git push --force-with-lease
   git checkout main
   ```

7. **公開確認**

   * ブラウザで `https://sentoku870.github.io/tumego/` を開き、

     * 表示崩れがないこと
     * 主要な機能が動作すること
       を確認する

## 3. 注意事項

* リリース作業中に **新しい feature / codex ブランチを main にマージしない**
* `dist/` の更新は「リリース用コミット」のときだけ行う
* `stable-20251116` 上で直接ファイルを編集しない（常に `main` を真とする）
* `git push --force-with-lease` を使う場面は、基本的に `stable-20251116` 更新時のみに限定する

## 4. よくある NG パターン

* `feature/*` や `codex/*` ブランチで `dist/` をコミットしてしまう
* テストが通っていない状態で `dist/` を更新し、そのまま `stable-20251116` に反映する
* GitHub Pages の公開設定を、仕様と異なるブランチやディレクトリに変えてしまう

いずれもリリースの再現性と安定性を壊すため禁止する。

````
