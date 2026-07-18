# Architecture

論理階層は **Feature**。依存方向は `Application System → System → Component → Feature → Part` に限定する。物理ファイルと論理階層を1対1にせず、このAssetは「任意LLM Providerの生成、HTTP境界、Request・Response変換を統一する。」の独立変更・独立検証境界を所有する。上位は公開契約を通して利用し、ModuleCatalogへ実行時依存しない。
