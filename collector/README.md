# Open Source Skill / Script Collector

GitHub、GitLab、npm、PyPI、crates.ioをキーワード別に検索し、言語を限定せずSkill・Script・Library・CLI・Adapter候補を収集します。Sourceを安全に展開し、Architecture、Logic、Entry Point、Public Symbol、Dependency、Test、Document、License、Secret Risk、模倣・再利用可能性を抽出します。

## 固定フロー

```text
Keyword Config
  -> Provider Adapter
  -> Candidate Deduplication
  -> Safe Archive Acquisition
  -> Multi-language Static Analysis
  -> Modular Asset Builder
  -> Astera /v1/skill/process
  -> Astera /v1/skill/evaluate
  -> Fail-closed Admission
  -> modular-catalog register
  -> Notion data-source upsert
  -> Draft PR
```

## 安全方針

- 外部Sourceは既定で実行しません。
- Path Traversal、Symlink、Archive容量、File数、Secret Patternを検査します。
- License不明または許可外はCatalog登録しません。
- Astera API未設定・失敗・95/95未満・BlockingありはCatalog登録しません。
- Source URL、Version/Ref、実Byte Content Hash、License、判定結果を保持します。
- 元Codeを無条件にコピーせず、Architecture・Logic・Capabilityを責務境界へ再構成します。
- NotionへはCatalog登録済み・Astera合格済みのRecordだけをUpsertします。

## 実行

```bash
cd collector
python -m unittest discover -s tests -p 'test_*.py'
python collector.py search \
  --config keywords.example.json \
  --workspace ../collector-output \
  --json
```

Astera判定、Catalog登録、Notion同期:

```bash
export ASTERA_PROCESS_BASE_URL=https://api.asterav8.jp
export ASTERA_EVALUATOR_BASE_URL=https://api.asterav8.jp
export ASTERA_SKILL_API_KEY='...'
export GITHUB_TOKEN='...'
export NOTION_TOKEN='...'
export NOTION_DATA_SOURCE_ID='10d3c0ac-5b2b-4f3b-8a22-a2b7685003bb'

python collector.py run \
  --config keywords.example.json \
  --workspace ../collector-output \
  --catalog-root .. \
  --register \
  --sync-notion \
  --process-limit 20 \
  --json
```

## 出力

- `discovery/candidates.json`: 検索候補
- `discovery/failures.json`: Provider単位の失敗
- `sources/`: 取得Source
- `candidates/<asset-id>/`: modular-catalog互換候補
- `results/admissions.json`: Local/Astera/Catalog判定
- `results/notion-export.json`: Notion検索台帳同期用Record
- `results/notion-sync-results.json`: Notion作成・更新・Skip・失敗結果

## Provider制約

- GitHub Repository SearchはTokenなしでもPublic Repositoryを取得できますが、Tokenありの方がRate Limitと取得範囲が安定します。
- GitLab Public Project一覧は未認証でも取得できます。Global Code Searchは認証・Edition設定に依存します。
- npmは検索結果からPackage Versionを確定し、Registry詳細の`dist.tarball`をSourceとして取得します。
- PyPIは公式の汎用JSON検索APIがないため、Web検索結果からProject名を抽出し、Project JSON APIで確定します。失敗時はProvider単位で記録して全体を継続します。
