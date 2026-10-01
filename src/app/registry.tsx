"use client";
import { useCallback, useEffect, useState } from "react";

type Entity =
  | "products"
  | "identifiers"
  | "channels"
  | "candidates"
  | "suppliers"
  | "proposals"
  | "plans"
  | "goals";
type Row = {
  id: string;
  name?: string;
  productId?: string;
  quantity?: number;
  unitCost?: string;
  currency?: string;
  nextAction?: string;
  value?: string;
  type?: string;
  externalProductId?: string;
  salesChannel?: string;
  targetProfit?: string;
  version?: number;
  product?: Row;
  supplier?: Row;
  candidate?: Row;
  proposal?: Row;
  [key: string]: unknown;
};
type Field = {
  key: string;
  label: string;
  kind?: "number" | "date" | "textarea";
  options?: string[];
  relation?: Entity;
  required?: boolean;
  default?: string;
};
const labels: Record<Entity, string> = {
  products: "商品",
  identifiers: "JAN / EAN",
  channels: "販売チャネル",
  candidates: "商品候補",
  suppliers: "仕入先",
  proposals: "仕入提案",
  plans: "数量別プラン",
  goals: "目標・上限",
};
const tax = ["UNKNOWN", "INCLUSIVE", "EXCLUSIVE"];
const product = {
  key: "productId",
  label: "商品",
  relation: "products" as const,
  required: true,
};
const fields: Record<Entity, Field[]> = {
  products: [
    { key: "name", label: "商品名", required: true },
    { key: "brand", label: "ブランド" },
    { key: "manufacturer", label: "メーカー" },
    { key: "category", label: "カテゴリー" },
    { key: "variant", label: "色・サイズ等" },
    {
      key: "packQuantity",
      label: "販売単位のセット数",
      kind: "number",
      default: "1",
      required: true,
    },
  ],
  identifiers: [
    product,
    { key: "type", label: "種類", options: ["JAN", "EAN", "UPC", "GTIN"] },
    { key: "value", label: "識別子（先頭の0も保存）", required: true },
    { key: "source", label: "情報元", required: true },
  ],
  channels: [
    product,
    { key: "salesChannel", label: "チャネル", options: ["AMAZON_JP", "EBAY"] },
    {
      key: "marketplace",
      label: "市場（Amazon JPはJP）",
      default: "JP",
      required: true,
    },
    { key: "externalProductId", label: "ASIN / 外部商品ID", required: true },
    {
      key: "condition",
      label: "状態",
      options: ["NEW", "USED", "REFURBISHED"],
    },
    {
      key: "matchStatus",
      label: "照合状態",
      options: ["UNCONFIRMED", "VERIFIED"],
    },
    { key: "matchEvidence", label: "照合根拠（確定時は必須）" },
  ],
  candidates: [
    product,
    {
      key: "channelProductId",
      label: "販売先（未照合なら未選択）",
      relation: "channels",
    },
    { key: "route", label: "発見経路", options: ["SUPPLIER", "MARKET"] },
    { key: "nextAction", label: "次の行動を1つ", required: true },
    { key: "nextActionDueAt", label: "行動期限（日本時間）", kind: "date" },
  ],
  suppliers: [
    { key: "name", label: "仕入先名", required: true },
    {
      key: "type",
      label: "種類（NETSEA / OROSY / MANUAL等）",
      default: "MANUAL",
    },
    { key: "country", label: "国コード", default: "JP" },
    { key: "url", label: "URL" },
    { key: "notes", label: "メモ", kind: "textarea" },
  ],
  proposals: [
    product,
    {
      key: "supplierId",
      label: "仕入先",
      relation: "suppliers",
      required: true,
    },
    { key: "supplierProductCode", label: "仕入先商品コード" },
    {
      key: "unitCost",
      label: "仕入単価（数値をそのまま入力）",
      required: true,
    },
    { key: "currency", label: "通貨", default: "JPY", required: true },
    { key: "taxBasis", label: "税区分", options: tax },
    { key: "moq", label: "MOQ", kind: "number", default: "1", required: true },
    {
      key: "orderMultiple",
      label: "発注単位（倍数）",
      kind: "number",
      default: "1",
      required: true,
    },
    {
      key: "quantityMin",
      label: "見積適用数量の下限",
      kind: "number",
      default: "1",
      required: true,
    },
    { key: "quantityMax", label: "見積適用数量の上限", kind: "number" },
    { key: "stock", label: "在庫（不明は空欄）", kind: "number" },
    { key: "leadTimeDays", label: "納期（日）", kind: "number" },
    { key: "returnTerms", label: "返品条件" },
    { key: "defectTerms", label: "不良条件" },
    { key: "source", label: "見積の情報元", required: true },
    {
      key: "confidence",
      label: "信頼度",
      options: ["UNKNOWN", "LOW", "MEDIUM", "HIGH"],
    },
    {
      key: "observedAt",
      label: "情報の観測日時（日本時間）",
      kind: "date",
      required: true,
    },
    {
      key: "fetchedAt",
      label: "取得日時（日本時間）",
      kind: "date",
      required: true,
    },
    { key: "validUntil", label: "有効期限（日本時間）", kind: "date" },
    { key: "costs", label: "費用明細（任意・JSON配列）", kind: "textarea" },
  ],
  plans: [
    {
      key: "candidateId",
      label: "商品候補",
      relation: "candidates",
      required: true,
    },
    {
      key: "supplierProposalId",
      label: "仕入提案",
      relation: "proposals",
      required: true,
    },
    { key: "quantity", label: "仕入数量", kind: "number", required: true },
    {
      key: "fulfillmentMethod",
      label: "販売方法",
      options: ["FBA", "FBM", "MANUAL"],
    },
    { key: "targetSaleStart", label: "販売開始予定（日本時間）", kind: "date" },
  ],
  goals: [
    { key: "name", label: "目標名", required: true },
    { key: "targetProfit", label: "目標利益", required: true },
    { key: "currency", label: "通貨", default: "JPY", required: true },
    {
      key: "periodStart",
      label: "期間開始（日本時間）",
      kind: "date",
      required: true,
    },
    {
      key: "periodEndExclusive",
      label: "期間終了の翌日0時（日本時間）",
      kind: "date",
      required: true,
    },
    { key: "sourcingBudget", label: "仕入予算", required: true },
    {
      key: "maxLossPerProduct",
      label: "1商品あたり最大許容損失",
      required: true,
    },
    {
      key: "maxConcurrentTests",
      label: "同時テスト上限",
      kind: "number",
      required: true,
    },
    {
      key: "profitBasis",
      label: "利益基準",
      options: ["BUSINESS_PROFIT", "PRODUCT_PROFIT"],
    },
  ],
};
const initialRecords = (): Record<Entity, Row[]> => ({
  products: [],
  identifiers: [],
  channels: [],
  candidates: [],
  suppliers: [],
  proposals: [],
  plans: [],
  goals: [],
});
function rowLabel(row: Row) {
  return (
    row.name ??
    row.product?.name ??
    row.candidate?.product?.name ??
    row.externalProductId ??
    row.value ??
    row.id
  );
}
function defaultValues(entity: Entity): Record<string, string> {
  return Object.fromEntries(
    fields[entity].map((f) => [f.key, f.default ?? f.options?.[0] ?? ""]),
  );
}
function jstInput(value: unknown) {
  return typeof value === "string"
    ? new Date(new Date(value).getTime() + 9 * 3600000)
        .toISOString()
        .slice(0, 16)
    : "";
}
export default function Registry() {
  const [entity, setEntity] = useState<Entity>("products");
  const [records, setRecords] = useState(initialRecords);
  const [values, setValues] = useState<Record<string, string>>(
    defaultValues("products"),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const load = useCallback(async () => {
    const entries = await Promise.all(
      (Object.keys(labels) as Entity[]).map(async (key) => {
        const r = await fetch(`/api/${key}`, { cache: "no-store" });
        if (!r.ok) throw Error((await r.json()).error);
        return [key, await r.json()] as const;
      }),
    );
    setRecords(Object.fromEntries(entries) as Record<Entity, Row[]>);
  }, []);
  useEffect(() => {
    load().catch((e) => {
      setError(true);
      setMessage(e.message);
    });
  }, [load]);
  function choose(key: Entity) {
    setEntity(key);
    setValues(defaultValues(key));
    setEditing(null);
    setMessage("");
    setError(false);
  }
  function edit(row: Row) {
    setEditing(row);
    setValues(
      Object.fromEntries(
        fields.goals.map((f) => [
          f.key,
          f.kind === "date"
            ? jstInput(row[f.key])
            : String(row[f.key] ?? f.default ?? f.options?.[0] ?? ""),
        ]),
      ),
    );
    setMessage("");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const data: Record<string, unknown> = {};
      for (const field of fields[entity]) {
        const value = values[field.key] ?? "";
        if (value.trim() === "") continue;
        data[field.key] =
          field.key === "costs"
            ? JSON.parse(value)
            : field.kind === "number"
              ? Number(value)
              : field.kind === "date"
                ? new Date(`${value}:00+09:00`).toISOString()
                : value;
      }
      const response = await fetch(
        editing ? `/api/goals/${editing.id}` : `/api/${entity}`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing ? { version: editing.version, goal: data } : data,
          ),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw Error(
          result.details
            ? result.details
                .map((d: { message: string }) => d.message)
                .join("\n")
            : result.error,
        );
      await load();
      setError(false);
      setMessage(editing ? "目標を更新しました。" : "登録しました。");
      setValues(defaultValues(entity));
      setEditing(null);
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <header>
        <div>
          <div className="eyebrow">RESELLING / FOUNDATION</div>
          <h1>小さく仕入れ、経験を残す。</h1>
          <p className="intro">
            商品・仕入条件・数量別プランを、ひとつずつ登録します。
          </p>
        </div>
        <span className="badge">Phase 1 · 手動登録</span>
      </header>
      <p className="note">
        現在は登録基盤です。市場分析・利益判定・購入承認はPhase
        2〜4で追加します。
      </p>
      <nav aria-label="登録メニュー">
        {(Object.keys(labels) as Entity[]).map((key) => (
          <button
            key={key}
            className={entity === key ? "active" : ""}
            onClick={() => choose(key)}
          >
            {labels[key]}
          </button>
        ))}
      </nav>
      <div className="grid">
        <section>
          <h2>
            {labels[entity]}
            {editing ? "を編集" : "を登録"}
          </h2>
          <form onSubmit={submit}>
            {fields[entity].map((field) => (
              <label key={field.key}>
                {field.label}
                {field.required ? " *" : ""}
                {field.options || field.relation ? (
                  <select
                    required={field.required}
                    value={values[field.key] ?? ""}
                    onChange={(e) =>
                      setValues({ ...values, [field.key]: e.target.value })
                    }
                  >
                    {field.relation && (
                      <option value="">選択してください</option>
                    )}
                    {field.options?.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                    {field.relation &&
                      records[field.relation].map((r) => (
                        <option key={r.id} value={r.id}>
                          {rowLabel(r)}
                          {r.supplier
                            ? ` / ${r.supplier.name} / ${r.unitCost} ${r.currency}`
                            : ""}{" "}
                          · {r.id.slice(0, 8)}
                        </option>
                      ))}
                  </select>
                ) : field.kind === "textarea" ? (
                  <textarea
                    value={values[field.key] ?? ""}
                    onChange={(e) =>
                      setValues({ ...values, [field.key]: e.target.value })
                    }
                  />
                ) : (
                  <input
                    required={field.required}
                    type={
                      field.kind === "date"
                        ? "datetime-local"
                        : field.kind === "number"
                          ? "number"
                          : "text"
                    }
                    min={field.kind === "number" ? 0 : undefined}
                    step={field.kind === "number" ? 1 : undefined}
                    value={values[field.key] ?? ""}
                    onChange={(e) =>
                      setValues({ ...values, [field.key]: e.target.value })
                    }
                  />
                )}
              </label>
            ))}
            {entity === "proposals" && (
              <p className="note">
                金額を入力しない費用はUNKNOWN、不要な費用はNOT_APPLICABLEで記録できます。費用例：
                <br />
                <code>
                  {
                    '[{"type":"DOMESTIC_SHIPPING","amount":"500","state":"KNOWN","chargeBasis":"PER_ORDER","taxBasis":"INCLUSIVE"}]'
                  }
                </code>
                <br />
                通貨は仕入提案と同じになります。未登録費用は0円とは扱いません。
              </p>
            )}
            {entity === "goals" && (
              <p className="note">
                12月31日までの目標は、終了日時に翌年1月1日0時を指定してください。金額・上限は自由に変更できます。
              </p>
            )}
            <button type="submit" disabled={busy}>
              {busy ? "保存中…" : editing ? "更新する" : "登録する"}
            </button>
            {editing && (
              <button type="button" onClick={() => choose("goals")}>
                編集をやめる
              </button>
            )}
            {message && (
              <div role="status" className={`message ${error ? "error" : ""}`}>
                {message}
              </div>
            )}
          </form>
        </section>
        <section>
          <div className="row">
            <h2>登録済みの{labels[entity]}</h2>
            <button
              onClick={() =>
                load().catch((e) => {
                  setError(true);
                  setMessage(e.message);
                })
              }
            >
              再読込
            </button>
          </div>
          <p className="note">直近200件を表示</p>
          {records[entity].length === 0 ? (
            <p className="empty">まだ登録がありません。</p>
          ) : (
            records[entity].map((row) => (
              <article key={row.id} className="record">
                <strong>{rowLabel(row)}</strong>
                <small>{row.id}</small>
                {row.supplier && <p>仕入先：{row.supplier.name}</p>}
                {row.unitCost !== undefined && (
                  <p>
                    仕入単価：{row.unitCost} {row.currency} ／ MOQ：
                    {String(row.moq)}
                  </p>
                )}
                {row.quantity !== undefined && (
                  <p>
                    数量：{row.quantity} ／ {String(row.fulfillmentMethod)}
                  </p>
                )}
                {row.nextAction && <p>次の行動：{row.nextAction}</p>}
                {row.salesChannel && (
                  <p>
                    {row.salesChannel} ／ {row.externalProductId}
                  </p>
                )}
                {row.value && (
                  <p>
                    {row.type}：{row.value}
                  </p>
                )}
                {row.targetProfit !== undefined && (
                  <>
                    <p>
                      目標：{row.targetProfit} {row.currency} ／ 仕入予算：
                      {String(row.sourcingBudget)}
                    </p>
                    <p>
                      最大損失：{String(row.maxLossPerProduct)} ／ 同時テスト：
                      {String(row.maxConcurrentTests)}
                    </p>
                    <button onClick={() => edit(row)}>目標を編集</button>
                  </>
                )}
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
