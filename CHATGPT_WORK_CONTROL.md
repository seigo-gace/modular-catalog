# ChatGPT Work Control

開発作業時は `control/index.json` を先に読み、作業に必要なSectionだけを読む。

- 常時適用：判断、禁止
- 設計・実装：開発方針
- 外部作業・引き継ぎ：担当
- Code・検証：検証
- README・Commit・Push：README・GitHub
- Code作成前と完成後：再利用資産

各Sectionの正本は `control/sections/`、整合性情報は `control/manifest.json` に置く。
