import { describe, it, expect } from "vitest";
import { Money, decimalAmount, ExactDecimal } from "../../src/domain/money";
import { validateQuantity } from "../../src/domain/quantity";
import {
  proposalInput,
  goalInput,
  identifierInput,
  costInput,
} from "../../src/application/inputs";
import { checkLocalRequest } from "../../src/infrastructure/http";

describe("Decimal金額", () => {
  it("0.1 + 0.2を正確に計算・JSON文字列保持", () =>
    expect(new Money("0.1").add(new Money("0.2")).toJSON().amount).toBe("0.3"));
  it("数量を掛けても誤差がない", () =>
    expect(new Money("19.99").multiply(3).amount.toFixed()).toBe("59.97"));
  it("端数配賦の合計が一致", () => {
    const a = new Money("100").allocate(3);
    expect(new ExactDecimal(a.each).times(2).plus(a.last).toFixed()).toBe(
      "100",
    );
  });
  it.each(["-1", "1e3", "NaN", "0.0000001", "100000000000000", "01", "0.1.2"])(
    "不正・DB範囲外の金額 %s を拒否",
    (v) => expect(() => decimalAmount(v)).toThrow(),
  );
  it("Number入力を拒否", () =>
    expect(() => decimalAmount(0.1 as unknown as string)).toThrow());
  it("通貨・税区分が違う金額を合算しない", () => {
    expect(() => new Money("1", "JPY").add(new Money("1", "USD"))).toThrow();
    expect(() =>
      new Money("1", "JPY", "INCLUSIVE").add(
        new Money("1", "JPY", "EXCLUSIVE"),
      ),
    ).toThrow();
  });
  it("最大値での加算オーバーフローを拒否", () =>
    expect(() =>
      new Money("99999999999999.999999").add(new Money("0.000001")),
    ).toThrow());
});
const terms = {
  moq: 3,
  orderMultiple: 2,
  quantityMin: 2,
  quantityMax: 10,
  stock: 8,
};
describe("数量条件", () => {
  it("同じ見積で4個と8個を許容", () => {
    expect(() => validateQuantity(4, terms)).not.toThrow();
    expect(() => validateQuantity(8, terms)).not.toThrow();
  });
  it.each([0, 2, 3, 9, 12, 1.5])("条件違反 %s", (q) =>
    expect(() => validateQuantity(q, terms)).toThrow(),
  );
  it("不明在庫を0と扱わない", () =>
    expect(() =>
      validateQuantity(10, { ...terms, stock: null }),
    ).not.toThrow());
});
describe("入力制約", () => {
  it("JANの先頭ゼロを保持", () =>
    expect(
      identifierInput.parse({
        productId: "11111111-1111-4111-8111-111111111111",
        type: "JAN",
        value: "0123456789012",
        source: "manual",
      }).value,
    ).toBe("0123456789012"));
  it("不明費用に金額を設定しない", () =>
    expect(
      costInput.safeParse({
        type: "OTHER",
        amount: "0",
        state: "UNKNOWN",
        chargeBasis: "PER_ORDER",
      }).success,
    ).toBe(false));
  it("KNOWNには金額必須", () =>
    expect(
      costInput.safeParse({
        type: "OTHER",
        state: "KNOWN",
        chargeBasis: "PER_ORDER",
      }).success,
    ).toBe(false));
  it("不要費用は未入力で表現", () =>
    expect(
      costInput.safeParse({
        type: "OTHER",
        state: "NOT_APPLICABLE",
        chargeBasis: "PER_ORDER",
      }).success,
    ).toBe(true));
  it("MOQより小さい見積上限を拒否", () =>
    expect(
      proposalInput.safeParse({
        productId: "11111111-1111-4111-8111-111111111111",
        supplierId: "22222222-2222-4222-8222-222222222222",
        unitCost: "1",
        moq: 5,
        quantityMax: 3,
        source: "manual",
        observedAt: "2026-10-01T00:00:00Z",
        fetchedAt: "2026-10-01T00:00:00Z",
      }).success,
    ).toBe(false));
  it("目標の未設定上限を拒否", () =>
    expect(
      goalInput.safeParse({ name: "test", targetProfit: "100" }).success,
    ).toBe(false));
  it("Next内部URLとHostが異なっても同じlocalhost Originを許可", () =>
    expect(() =>
      checkLocalRequest(
        new Request("http://localhost:3000/api/products", {
          headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
        }),
        true,
      ),
    ).not.toThrow());
  it("別サイトからの更新拒否", () =>
    expect(() =>
      checkLocalRequest(
        new Request("http://localhost:3000/api/products", {
          headers: { host: "localhost:3000", origin: "https://example.com" },
        }),
        true,
      ),
    ).toThrow());
});
