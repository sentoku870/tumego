# docs/ – Tumego Web App 公式ドキュメント（AI補助用）

このフォルダは、GitHub リポジトリ `sentoku870/tumego` の **公式ドキュメント入口** です。

- 主な読者:
  - ChatGPT / Codex / DeepResearch などの「開発支援 AI」
  - 将来の自分（開発運用を思い出したいとき）

- 目的:
  - リポジトリ内の設計・運用ルールを **機械が読みやすい形** でまとめる
  - 「どのブランチを触ってよいか」「dist の扱い」「Codex に何を任せてよいか」を明示する

- 優先順位:
  - `docs/` 内のドキュメントは、同じ内容を扱う他の md/docx ファイルよりも **優先される公式仕様** とする
  - より詳細な背景説明は、リポジトリ直下や `テキスト資料/` などにある設計メモを参照する

まずは次の文書から読むことを推奨する:

1. `00-overview.md` – プロジェクト全体の概要とドキュメント構成
2. `10-branch-strategy.md` – ブランチ運用ポリシー
3. `11-release-flow.md` – リリース手順（stable ブランチと dist の更新）
4. `12-dist-handling.md` – dist/ ディレクトリの扱い
5. `20-codex-rules.md` – Codex / DeepResearch に関するルール
