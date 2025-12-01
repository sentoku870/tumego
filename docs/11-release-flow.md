#### 手順5: docs/11-release-flow.md の作成

````markdown
# 11 – リリースフロー（stable ブランチと dist 更新）

## 1. 前提

- GitHub Pages は `stable-20251116 / (root)` から公開されている
- リリースは必ず `main` を起点に行う
- dist/ ディレクトリは `.gitignore` されておらず、リリース時にのみ更新する

## 2. リリース手順チェックリスト

1. **main を最新にする**
   ```pwsh
   git checkout main
   git pull --ff-only
````

2. **テスト実行**

   ```pwsh
   npm test
   ```

   * すべて成功していることを確認する

3. **ビルド実行**

   ```pwsh
   npm run build
   ```

   * `dist/` 配下にビルド成果物が生成される

4. **dist/ をコミット**

   ```pwsh
   git add dist
   git commit -m "chore: update dist for vX.Y.Z"
   git push
   ```

   * コミットメッセージのバージョン番号は適宜変更する

5. **stable ブランチを main に同期**

   ```pwsh
   git checkout stable-20251116
   git reset --hard main
   git push -f origin stable-20251116
   git checkout main
   ```

6. **公開確認**

   * ブラウザで `https://sentoku870.github.io/tumego/` を開き、表示と動作に問題がないか確認する

## 3. 注意事項

* リリース作業中に **feature や codex ブランチを main にマージしない**
* dist/ の更新は、リリース用コミット（手順 4）のときだけ行う
* stable-20251116 上で直接ファイルを編集しない（常に main を真とする）

````
