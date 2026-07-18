# Architecture

論理階層は **System**。依存方向は `Application System → System → Component → Feature → Part` に限定する。物理ファイルと論理階層を1対1にせず、このAssetは「Tenant、Rate Limit、Usage、Subscription、Application状態永続化を運用境界として統合する。」の独立変更・独立検証境界を所有する。上位は公開契約を通して利用し、ModuleCatalogへ実行時依存しない。
