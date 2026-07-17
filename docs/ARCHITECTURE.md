# Architecture

## 目的

完成・検証済みのCodeと、それを成立させる設計・Logic・Architecture・Test・検証証跡を一体管理し、必要な資産だけを少ないContextで再利用する。

## 5段階層型モジュラーアーキテクチャ

- **Part**: 正規化、Hash、Secret検査、安全なPath処理、Score計算
- **Feature**: 資産検証、登録、Index生成、多段検索、選択読込、整合性検証
- **Component**: Catalog Engine
- **System**: Modular Catalog
- **Application System**: Repository起点の再利用開発基盤

5段は論理構造であり、物理Directoryを階層ごとに作らない。

## 多段検索

1. **入口**: `catalog/index.json`だけを読む。ID、Hash、目的、責務、言語、Runtime、Layer、Tagを圧縮保持する。
2. **候補選定**: QueryとFilterをIndex上で採点し、候補数を限定する。
3. **Metadata確認**: 上位候補の`meta.json`だけを読み、依存・制約・互換性を再評価する。
4. **選択読込**: 採用候補の設計、Logic、Architecture、Code、Test、Evidenceだけを読む。
5. **整合性確認**: `manifest.json`のSHA-256で改変・欠落を検出する。

通常経路では全資産を一括読込しない。

## 安全性

- 登録時に必須文書、Code、二系統Test、合格Evidenceを検証する。
- Secretらしき内容、Symbolic Link、Path逸脱、未検証資産を拒否する。
- Asset IDの上書きは既定で拒否する。
- Indexは派生物であり、Asset一式とManifestが正本である。
- Catalogは実行時共通Coreではない。資産は対象Projectへ取り込み、対象条件で再検証する。
