# 物販検証システム

商品候補・仕入見積・数量別プランを登録するPhase 1基盤。Next.js / TypeScript / PostgreSQL / Prisma / Decimal。

## 起動

Node.js 20.19以上（推奨22）、npmが必要。

```sh
npm ci
cp .env.example .env
```

Dockerを使う場合：

```sh
docker compose up -d db
npm run db:migrate
npm run dev
```

Dockerがない場合は、別ターミナルで `npm run db:local` を起動し、その後 `npm run db:migrate` と `npm run dev` を実行する。開発用のPostgreSQLがwork/local-postgresへ永続保存される。Ctrl+Cで停止でき、同じコマンドで再開できる。両方を同じポートで同時起動しない。

[http://127.0.0.1:3000](http://127.0.0.1:3000) を開く。商品→識別子/チャネル→候補→仕入先→提案→数量別プランの順に登録。目標は独立して設定できる。目標・期限・予算・損失上限はコード固定されていない。

## テスト

```sh
npm run typecheck
npm test
npm run build
npm run test:db
```

test:dbは一時ディレクトリと空きポートに実PostgreSQLを作り、migrationを2回適用、DB制約の統合テスト、本番HTTP登録テスト、DB停止/再起動による永続化検証を行う。本番ビルドが先に必要。既存DBや.envには触れない。テストDBは終了時に削除する。

`npm run db:dev -- --name <name>` は開発用migration作成、`db:migrate` はチェック制約・トリガーを含む確定migration適用。**prisma db pushだけでは業務制約を導入できない**。変更時は既存migrationを書き換えず追加する。

## 保存モデルとAPI

Product / ProductIdentifier / ChannelProduct / Candidate / Supplier / SupplierProposal / ProposalCost / SourcingPlan / Goal。

`GET/POST /api/{products,identifiers,channels,candidates,suppliers,proposals,plans,goals}`。一覧は直近200件。Goalは `PATCH /api/goals/:id` に `{ "version": 1, "goal": { ...全設定 } }` を渡して変更する。同時変更は409。

金額はJSONでも文字列（例 `"0.1"`）。費用はKNOWN（金額必須）/UNKNOWN/NOT_APPLICABLE（金額なし）を区別。見積と費用の作成は同一transaction。MOQ・発注単位・数量範囲・既知在庫を検査し、別商品の提案を同じプランへ関連付けることを禁止。参照済み見積の更新はDBも拒否し、新しい見積を作る。

識別子の形式・桁数は検証するが、JAN/EANのチェックディジットや商品一致を保証するものではない。照合はUNCONFIRMEDから開始し、VERIFIEDには根拠が必要。

Phase 1はローカル専用。dev/startとDBはloopbackへbindし、APIはHostと更新Originを検査する。ログイン/公開運用は未実装。外部アクセスが必要になった時点で認証を追加する。APIキー・.env・DB・実仕入記録はコミットしない。

## 範囲と次の工程

Keepa実API・SP-API、市場分析、着地原価の業務計算、利益判定、発注承認、PurchaseLot/SalesActual/Validationは未実装。今回のMoneyは精度・通貨/税区分・整数数量・端数配賦の共通土台だけ。

実販売開始目標は**Phase 4完了時点**。Phase 5〜6前の実績は [移行用記録テンプレート](docs/early-records/README.md) で保存し、Phase 6で正式モデルへ移行する。

[仕様](docs/requirements-v1.0.md) / [設計レビュー](docs/development-review.md) / [Phase 1報告](docs/phase1-report.md)
