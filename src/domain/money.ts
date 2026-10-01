import Decimal from "decimal.js";

// Avoid binary floating point at the boundary as well as in calculations.
export const ExactDecimal = Decimal.clone({
  precision: 50,
  rounding: Decimal.ROUND_HALF_UP,
});
export type TaxBasis = "INCLUSIVE" | "EXCLUSIVE" | "UNKNOWN";
export function decimalAmount(value: string): Decimal {
  if (
    typeof value !== "string" ||
    !/^(0|[1-9]\d{0,13})(\.\d{1,6})?$/.test(value)
  ) {
    throw new Error(
      "金額は非負の十進文字列（整数14桁・小数6桁以内）で入力してください",
    );
  }
  return new ExactDecimal(value);
}
export class Money {
  readonly amount: Decimal;
  constructor(
    value: string,
    readonly currency = "JPY",
    readonly taxBasis: TaxBasis = "UNKNOWN",
  ) {
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("通貨コードが不正です");
    this.amount = decimalAmount(value);
  }
  add(other: Money): Money {
    if (this.currency !== other.currency || this.taxBasis !== other.taxBasis)
      throw new Error("通貨と税区分を揃えてください");
    return new Money(
      this.amount.plus(other.amount).toFixed(),
      this.currency,
      this.taxBasis,
    );
  }
  multiply(quantity: number): Money {
    if (!Number.isSafeInteger(quantity) || quantity < 1)
      throw new Error("数量は正の整数です");
    return new Money(
      this.amount.times(quantity).toFixed(),
      this.currency,
      this.taxBasis,
    );
  }
  // Allocate at database scale without losing the total through rounding.
  allocate(quantity: number): { each: string; last: string } {
    if (!Number.isSafeInteger(quantity) || quantity < 1)
      throw new Error("数量は正の整数です");
    const each = this.amount
      .div(quantity)
      .toDecimalPlaces(6, Decimal.ROUND_DOWN);
    return {
      each: each.toFixed(6),
      last: this.amount.minus(each.times(quantity - 1)).toFixed(6),
    };
  }
  toJSON() {
    return {
      amount: this.amount.toFixed(),
      currency: this.currency,
      taxBasis: this.taxBasis,
    };
  }
}
