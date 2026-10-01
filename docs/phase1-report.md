# Phase 1 実装報告

2026-10-01 / scope: 保存基盤・金額型・手動登録UIのみ。

## 作成・変更したファイル

- `package.json` / `package-lock.json`：Next.js 16.3.8、React、TypeScript、Prisma 6.19.3、Decimal、Zod、Vitest、実PostgreSQLテスト用ランタイム。依存を固定。
- `prisma/schema.prisma`：指定の9モデルと列挙型。
- `prisma/migrations/202610010001_foundation/migration.sql` / `202610010002_finite_money/migration.sql` / `migration_lock.toml`：PostgreSQLのテーブル、索引、FK、CHECK、数量・見積保護トリガー。
- `src/domain/money.ts` / `quantity.ts`：十進文字列、精度検証、通貨・税区分、整数数量、端数配賦、MOQ等の検証。
- `src/application/inputs.ts` / `records.ts`：入力schema、登録・取得、数量別プラン、目標の版付き変更。
- `src/infrastructure/db.ts` / `http.ts`：DB接続、ローカルアクセスと更新Originチェック、エラー応答。
- `src/app/api/[entity]/route.ts` / `api/goals/[id]/route.ts`：GET/POST登録APIとGoal PATCH。
- `src/app/{layout,page,registry}.tsx` / `globals.css`：商品・識別子・チャネル・候補・仕入先・提案・プラン・目標の最小登録画面。
- `scripts/test-db.ts` / `http-smoke.ts` / `db-local.ts`：実DBテスト、HTTP検証、Docker不要のローカルDB起動。
- `tests/unit/foundation.test.ts` / `tests/integration/database.test.ts`：金額・入力・数量・DB制約の自動テスト。
- `.github/workflows/ci.yml`：型・単体・build・実DBテストをpush/PRで実行。
- `.env.example` / `.gitignore` / `compose.yaml` / `tsconfig.json` / `next-env.d.ts` / `next.config.ts`：環境と永続化構成。
- `README.md`：起動・migration・API・制限。
- `docs/development-review.md`：Phase 4で実販売開始できる目標へ更新。
- `docs/early-records/{README.md,decisions.csv,purchases.csv,sales.csv}`：Phase 4〜6間の記録・移行契約案。
- 本報告。元のrequirements-v1.0.mdは原文として保持。

## DBモデル

Product、ProductIdentifier、ChannelProduct、Candidate、Supplier、SupplierProposal、ProposalCost、SourcingPlan、Goal。

UUIDのProductを中心にJAN/EAN等をProductIdentifier、ASINをChannelProductへ分離。ChannelProductはAMAZON_JP/EBAYの共通外部商品表現で、API連携はない。CandidateとSupplierProposalはProductに結び付け、SourcingPlanは商品一致を複合FKで保証。商品→複数仕入先→同じ見積の複数量に対応。

Goalに目標利益、開始/終了、仕入予算、商品損失上限、同時テスト上限、利益基準、版を保存。特定目標額や期限をコード固定していない。期間はUTCで保存、日本時間で入力し排他的終了日時を使う。

## migrationと制約

- 初期migrationを空の実PostgreSQLへ適用し、再適用でpendingなしを確認。
- 金額はNUMERIC(20,6)。APIは非負の十進文字列、整数最大14桁・小数最大6桁。Number入力や指数表記を拒否。計算用Decimalは50桁精度。
- NaN金額の拒否、金額・数量・予算の非負、同時テスト上限の正数、目標期間の順序、通貨・税区分。
- 商品セット数は正数。識別子は文字列と桁数・数字形式、種類と値の重複防止。ASINは10桁英数字。照合確定は根拠必須。
- CandidateとChannelProduct、CandidateとPlanとProposalは同じProduct。参照削除は禁止。
- MOQ、発注単位の倍数、見積上下限、既知在庫をサービスとDBトリガーの両方で検証。
- 費用はKNOWN（金額必須）/UNKNOWN/NOT_APPLICABLE（金額なし）。費用通貨は見積と一致。見積内で費用種類は一意。
- 商品・先・数量・販売方法が同じプランの重複は409。同一見積の異なる数量は登録可能。
- 参照済み提案は上書きせず新規見積を作る。既存プランのある候補の商品・チャネル基盤変更を禁止。
- アクティブ候補は次の行動必須。Goalの変更はversion一致を必要とし、競合は409。
- eBayの基盤プランはMANUALのみ。Amazon分析・eBay分析は未実装。

## 自動テスト結果（ローカル）

| 確認 | 結果 |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | 29件 PASS |
| `npm run build` | PASS、ページと登録/Goal更新APIの本番ビルド |
| 実PostgreSQL統合テスト | 24件 PASS |
| migration初回/再適用 | PASS |
| 本番HTTP登録フロー | PASS、商品/識別子/チャネル/候補/仕入先/提案/複数量プラン/目標変更 |
| HTTPの不正金額・数量・版競合・別Origin | PASS、400/422/409/403 |
| PostgreSQLプロセス停止→再起動 | PASS、商品/見積/プラン件数とDecimal目標値を確認 |
| `npm audit` | 検出0件（確認時点） |
| `git diff --check` | PASS |

ブラウザからサンプル商品を登録し、成功表示と保存された一覧も確認。テスト用の一時DBは停止・削除し、手動確認用のローカルDBはGit管理外に保存した。

Docker daemonは起動していなかったためDocker compose自体の起動確認は未実施。DBテストはSQLite/mockではなく、隔離した実PostgreSQL 18.4で行った。通常用Composeの永続ボリューム設定と、検証済みローカルPostgreSQL起動スクリプトの両方を提供する。

GitHub CIはワークフローを追加済み。上記はローカル結果であり、リモートCI実行結果とは区別する。

## 完了条件

1〜10：手動登録・識別子/チャネル分離・複数仕入先/複数量・数量条件・正確な金額型・Goal保存を実装、テスト済み。11：実DBプロセス再起動で保持を確認。12：migration・主要制約・金額型の自動テスト通過。

## 未実装

Keepa実API、SP-API、市場履歴、季節性分析、着地原価の業務計算、シナリオ利益・最大損失・最大仕入単価・数量推奨、購入最終承認、不変DecisionSnapshot、PurchaseLot/SalesActual/Validation、正式CSVインポーター。今回のCSVは移行可能な手動記録用の空テンプレートのみ。

公開認証、マルチユーザー、商品/提案の編集・削除UI、200件超のページング、チェックディジット検証も未実装。登録基盤を優先した。金額型の基礎計算は実装したが、Phase 3の着地原価やPhase 4の利益計算を先行実装していない。

## Phase 2へ進む前の懸念

- 商品照合とJAN/EAN形式検証は別。実商品ではセット数・状態・ASIN対応を人間確認する。
- 不明費用や欠損在庫を0と扱わない。Phase 2〜4で鮮度と不足情報のGateを加える。
- Phase 1のプランは構造・数量条件を満たした記録であり、購入推奨ではない。未照合でも登録可だが、後の購入承認には不可。
- 手動見積は数量条件ごとの新規提案で版管理する。価格段階や別送料条件を無条件で流用しない。
- 現行金額型は通貨/税区分を保持するだけ。異なる通貨・税区分を自動換算/合算しない。
- 目標予算、損失上限、同時テスト上限、FBA/FBM、利用場所は実運用の入力/選択が必要。公開利用へ変える場合は認証を先に導入。
- Phase 4を早期販売開始点にするため、最終確認・予測固定・ID付きCSV記録もPhase 4の完了条件に含める。Phase 6を開始の待機条件にしない。

Phase 2以降には進んでいない。
