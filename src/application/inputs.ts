import { z } from "zod";
import { decimalAmount } from "../domain/money";
const text = z.string().trim().min(1).max(1000);
const optionalText = text.optional();
const uuid = z.uuid();
const positive = z.number().int().min(1).max(2147483647);
const nonnegative = z.number().int().min(0).max(2147483647);
const amount = z.string().refine((v) => {
  try {
    decimalAmount(v);
    return true;
  } catch {
    return false;
  }
}, "金額は非負の十進文字列（14桁/小数6桁以内）です");
const currency = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .default("JPY");
const taxBasis = z
  .enum(["INCLUSIVE", "EXCLUSIVE", "UNKNOWN"])
  .default("UNKNOWN");
const date = z.iso.datetime({ offset: true }).transform((v) => new Date(v));
const url = z
  .url()
  .refine((v) => ["http:", "https:"].includes(new URL(v).protocol));
export const productInput = z
  .object({
    name: text,
    brand: optionalText,
    manufacturer: optionalText,
    category: optionalText,
    variant: optionalText,
    packQuantity: positive.default(1),
  })
  .strict();
export const identifierInput = z
  .object({
    productId: uuid,
    type: z.enum(["JAN", "EAN", "UPC", "GTIN"]),
    value: z.string().regex(/^\d+$/),
    source: text,
    verifiedAt: date.optional(),
  })
  .strict()
  .refine(
    (v) =>
      ({ JAN: [8, 13], EAN: [8, 13], UPC: [12], GTIN: [8, 12, 13, 14] })[
        v.type
      ].includes(v.value.length),
    "識別子の桁数が不正です",
  );
export const channelInput = z
  .object({
    productId: uuid,
    salesChannel: z.enum(["AMAZON_JP", "EBAY"]),
    marketplace: text,
    externalProductId: text,
    condition: z.enum(["NEW", "USED", "REFURBISHED"]).default("NEW"),
    matchStatus: z.enum(["UNCONFIRMED", "VERIFIED"]).default("UNCONFIRMED"),
    matchEvidence: optionalText,
  })
  .strict()
  .refine(
    (v) =>
      v.salesChannel !== "AMAZON_JP" ||
      (v.marketplace === "JP" && /^[A-Z0-9]{10}$/.test(v.externalProductId)),
    "Amazon JPはmarketplace=JPと10桁のASINが必要です",
  )
  .refine(
    (v) => v.matchStatus !== "VERIFIED" || !!v.matchEvidence,
    "照合確定には根拠が必要です",
  );
export const candidateInput = z
  .object({
    productId: uuid,
    channelProductId: uuid.optional(),
    route: z.enum(["SUPPLIER", "MARKET"]),
    nextAction: text,
    nextActionDueAt: date.optional(),
  })
  .strict();
export const supplierInput = z
  .object({
    name: text,
    type: text.default("MANUAL"),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .default("JP"),
    url: url.optional(),
    notes: optionalText,
  })
  .strict();
export const costInput = z
  .object({
    type: z.enum([
      "DOMESTIC_SHIPPING",
      "INTERNATIONAL_SHIPPING",
      "CUSTOMS",
      "IMPORT_TAX",
      "PAYMENT_FEE",
      "FX_FEE",
      "CUSTOMS_CLEARANCE",
      "INSPECTION",
      "OTHER",
    ]),
    amount: amount.optional(),
    state: z.enum(["KNOWN", "UNKNOWN", "NOT_APPLICABLE"]),
    chargeBasis: z.enum(["PER_UNIT", "PER_ORDER"]),
    taxBasis,
    source: optionalText,
  })
  .strict()
  .refine(
    (v) =>
      v.state === "KNOWN" ? v.amount !== undefined : v.amount === undefined,
    "KNOWNは金額必須、それ以外は金額を指定しないでください",
  );
export const proposalInput = z
  .object({
    supplierId: uuid,
    productId: uuid,
    supplierProductCode: optionalText,
    unitCost: amount,
    currency,
    taxBasis,
    moq: positive.default(1),
    orderMultiple: positive.default(1),
    quantityMin: positive.default(1),
    quantityMax: positive.optional(),
    stock: nonnegative.optional(),
    leadTimeDays: nonnegative.optional(),
    returnTerms: optionalText,
    defectTerms: optionalText,
    directShipAllowed: z.boolean().optional(),
    source: text,
    confidence: z.enum(["UNKNOWN", "LOW", "MEDIUM", "HIGH"]).default("UNKNOWN"),
    fetchedAt: date,
    observedAt: date,
    validUntil: date.optional(),
    costs: z.array(costInput).max(9).default([]),
  })
  .strict()
  .refine(
    (v) =>
      v.quantityMax === undefined ||
      v.quantityMax >= Math.max(v.moq, v.quantityMin),
    "見積上限がMOQ・下限より小さいです",
  )
  .refine(
    (v) => v.observedAt <= v.fetchedAt,
    "情報の観測日時は取得日時以前です",
  )
  .refine(
    (v) => !v.validUntil || v.validUntil >= v.observedAt,
    "見積有効期限が観測日時より前です",
  )
  .refine(
    (v) => new Set(v.costs.map((c) => c.type)).size === v.costs.length,
    "費用種類が重複しています",
  );
export const planInput = z
  .object({
    candidateId: uuid,
    supplierProposalId: uuid,
    quantity: positive,
    fulfillmentMethod: z.enum(["FBA", "FBM", "MANUAL"]),
    targetSaleStart: date.optional(),
  })
  .strict();
export const goalInput = z
  .object({
    name: text,
    targetProfit: amount,
    currency,
    periodStart: date,
    periodEndExclusive: date,
    timezone: z.literal("Asia/Tokyo").default("Asia/Tokyo"),
    profitBasis: z
      .enum(["BUSINESS_PROFIT", "PRODUCT_PROFIT"])
      .default("BUSINESS_PROFIT"),
    sourcingBudget: amount,
    maxLossPerProduct: amount,
    maxConcurrentTests: positive,
  })
  .strict()
  .refine(
    (v) => v.periodStart < v.periodEndExclusive,
    "終了日時は開始日時より後です",
  );
export const goalUpdateInput = z
  .object({ version: positive, goal: goalInput })
  .strict();
