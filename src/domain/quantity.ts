export type QuantityTerms = {
  moq: number;
  orderMultiple: number;
  quantityMin: number;
  quantityMax: number | null;
  stock: number | null;
};
export function validateQuantity(quantity: number, terms: QuantityTerms): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647)
    throw new Error("数量は正の整数です");
  if (quantity < Math.max(terms.moq, terms.quantityMin))
    throw new Error("MOQ・見積下限を満たしていません");
  if (quantity % terms.orderMultiple !== 0)
    throw new Error("発注単位の倍数で入力してください");
  if (terms.quantityMax !== null && quantity > terms.quantityMax)
    throw new Error("見積上限を超えています");
  if (terms.stock !== null && quantity > terms.stock)
    throw new Error("仕入先在庫を超えています");
}
