# Logic

- Evidence不足やContract不足を成功へ補完しない。
- UNKNOWN/不足はBLOCKEDまたは明示的な不足として返す。
- 外部候補Repositoryは設計参照のみで、Source codeを直接取り込まない。
- 再利用先でAdapterを介して現在のContractへ接続する。
