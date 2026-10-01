import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PrismaClient, Prisma } from "@prisma/client";
import { createRecord, updateGoal } from "../../src/application/records";
const db = new PrismaClient();
let productId: string,
  candidateId: string,
  supplierId: string,
  proposalId: string,
  channelId: string,
  goalId: string;
const time = "2026-10-01T09:00:00+09:00";
const goal = {
  name: "editable target",
  targetProfit: "12345.67",
  currency: "JPY",
  periodStart: time,
  periodEndExclusive: "2027-01-01T00:00:00+09:00",
  sourcingBudget: "98765.43",
  maxLossPerProduct: "1234.56",
  maxConcurrentTests: 2,
};
const quote = () => ({
  productId,
  supplierId,
  unitCost: "0.1",
  currency: "JPY",
  taxBasis: "INCLUSIVE",
  moq: 3,
  orderMultiple: 2,
  quantityMin: 2,
  quantityMax: 10,
  stock: 8,
  source: "manual quote",
  observedAt: time,
  fetchedAt: time,
  costs: [
    {
      type: "DOMESTIC_SHIPPING",
      amount: "0.2",
      state: "KNOWN",
      chargeBasis: "PER_ORDER",
      taxBasis: "INCLUSIVE",
    },
    {
      type: "INTERNATIONAL_SHIPPING",
      state: "NOT_APPLICABLE",
      chargeBasis: "PER_ORDER",
    },
    { type: "OTHER", state: "UNKNOWN", chargeBasis: "PER_ORDER" },
  ],
});
beforeAll(async () => {
  productId = (await db.product.create({ data: { name: "manual product" } }))
    .id;
  channelId = (
    await db.channelProduct.create({
      data: {
        productId,
        salesChannel: "AMAZON_JP",
        marketplace: "JP",
        externalProductId: "B000000001",
      },
    })
  ).id;
  candidateId = (
    await db.candidate.create({
      data: {
        productId,
        channelProductId: channelId,
        route: "SUPPLIER",
        nextAction: "仕入条件を確認",
      },
    })
  ).id;
  supplierId = (await db.supplier.create({ data: { name: "first supplier" } }))
    .id;
  proposalId = (
    (await createRecord(db, "proposals", quote())) as { id: string }
  ).id;
  goalId = ((await createRecord(db, "goals", goal)) as { id: string }).id;
});
afterAll(() => db.$disconnect());
describe("migrationと実PostgreSQL", () => {
  it("migrationが一度だけ適用される", async () => {
    const r = await db.$queryRaw<
      Array<{ n: bigint }>
    >`SELECT count(*) AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    expect(Number(r[0].n)).toBe(2);
  });
  it("識別子は商品本体から分離し先頭0を保持", async () => {
    await createRecord(db, "identifiers", {
      productId,
      type: "JAN",
      value: "0123456789012",
      source: "manual",
    });
    const r = await db.product.findUniqueOrThrow({
      where: { id: productId },
      include: { identifiers: true, channels: true },
    });
    expect(r.identifiers[0].value).toBe("0123456789012");
    expect(r.channels[0].salesChannel).toBe("AMAZON_JP");
  });
  it("別商品への識別子重複を拒否", async () => {
    const p = await db.product.create({ data: { name: "other" } });
    await expect(
      db.productIdentifier.create({
        data: {
          productId: p.id,
          type: "JAN",
          value: "0123456789012",
          source: "manual",
        },
      }),
    ).rejects.toThrow();
  });
  it("同じ商品に複数仕入先の提案を登録", async () => {
    const s = await db.supplier.create({ data: { name: "second supplier" } });
    await createRecord(db, "proposals", { ...quote(), supplierId: s.id });
    expect(await db.supplierProposal.count({ where: { productId } })).toBe(2);
  });
  it("同じ提案で4個と8個のプランを登録", async () => {
    for (const quantity of [4, 8])
      await createRecord(db, "plans", {
        candidateId,
        supplierProposalId: proposalId,
        quantity,
        fulfillmentMethod: "FBA",
      });
    expect(
      await db.sourcingPlan.count({
        where: { supplierProposalId: proposalId },
      }),
    ).toBe(2);
  });
  it("サービスがMOQ違反を拒否", async () => {
    await expect(
      createRecord(db, "plans", {
        candidateId,
        supplierProposalId: proposalId,
        quantity: 2,
        fulfillmentMethod: "FBA",
      }),
    ).rejects.toThrow("MOQ");
  });
  it("DB直書きでもMOQ違反を拒否", async () => {
    await expect(
      db.sourcingPlan.create({
        data: {
          productId,
          candidateId,
          supplierProposalId: proposalId,
          quantity: 2,
          fulfillmentMethod: "FBA",
        },
      }),
    ).rejects.toThrow();
  });
  it.each([3, 10, 12])(
    "DBが発注単位/在庫/上限違反 %s を拒否",
    async (quantity) => {
      await expect(
        db.sourcingPlan.create({
          data: {
            productId,
            candidateId,
            supplierProposalId: proposalId,
            quantity,
            fulfillmentMethod: "FBA",
          },
        }),
      ).rejects.toThrow();
    },
  );
  it("別商品の提案を関連付けられない", async () => {
    const p = await db.product.create({ data: { name: "different" } });
    const q = (await createRecord(db, "proposals", {
      ...quote(),
      productId: p.id,
    })) as { id: string };
    await expect(
      createRecord(db, "plans", {
        candidateId,
        supplierProposalId: q.id,
        quantity: 4,
        fulfillmentMethod: "FBA",
      }),
    ).rejects.toThrow("商品が異なります");
    await expect(
      db.sourcingPlan.create({
        data: {
          productId,
          candidateId,
          supplierProposalId: q.id,
          quantity: 4,
          fulfillmentMethod: "FBA",
        },
      }),
    ).rejects.toThrow();
  });
  it("別商品のChannelProductをCandidateへ紐づけられない", async () => {
    const p = await db.product.create({ data: { name: "channel mismatch" } });
    await expect(
      db.candidate.create({
        data: {
          productId: p.id,
          channelProductId: channelId,
          route: "MARKET",
          nextAction: "確認",
        },
      }),
    ).rejects.toThrow();
  });
  it("未照合候補を登録可能", async () => {
    expect(
      (
        (await createRecord(db, "candidates", {
          productId,
          route: "SUPPLIER",
          nextAction: "ASINを照合",
        })) as { id: string }
      ).id,
    ).toBeTruthy();
  });
  it("DecimalをDB・JSON間で文字列保持", async () => {
    const q = await db.supplierProposal.findUniqueOrThrow({
      where: { id: proposalId },
      include: { costs: true },
    });
    const shipping = q.costs.find((c) => c.type === "DOMESTIC_SHIPPING")!;
    expect(q.unitCost.plus(shipping.amount!).toFixed()).toBe("0.3");
    expect(JSON.parse(JSON.stringify(q)).unitCost).toBe("0.1");
    expect(q.costs.find((c) => c.type === "OTHER")!.amount).toBeNull();
  });
  it("DBは負数金額と不正費用状態を拒否", async () => {
    await expect(
      db.supplierProposal.create({
        data: {
          productId,
          supplierId,
          unitCost: "-1",
          source: "manual",
          observedAt: new Date(time),
          fetchedAt: new Date(time),
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.proposalCost.create({
        data: {
          proposalId,
          type: "CUSTOMS",
          currency: "JPY",
          state: "UNKNOWN",
          amount: "0",
          chargeBasis: "PER_ORDER",
        },
      }),
    ).rejects.toThrow();
  });
  it("DBがNUMERICのNaNも拒否", async () => {
    await expect(
      db.$executeRaw`UPDATE "Goal" SET "targetProfit" = 'NaN'::numeric WHERE "id" = ${goalId}::uuid`,
    ).rejects.toThrow();
    await expect(
      db.$executeRaw`UPDATE "ProposalCost" SET "amount" = 'NaN'::numeric WHERE "proposalId" = ${proposalId}::uuid AND "state" = 'KNOWN'`,
    ).rejects.toThrow();
  });
  it("費用通貨と見積通貨が一致する", async () => {
    await expect(
      db.proposalCost.create({
        data: {
          proposalId,
          type: "CUSTOMS",
          currency: "USD",
          state: "KNOWN",
          amount: "1",
          chargeBasis: "PER_ORDER",
        },
      }),
    ).rejects.toThrow();
  });
  it("有効な目標を保存・変更し古い版の更新を拒否", async () => {
    const g = await db.goal.findUniqueOrThrow({ where: { id: goalId } });
    expect(g.targetProfit.toFixed()).toBe(goal.targetProfit);
    expect(g.sourcingBudget.toFixed()).toBe(goal.sourcingBudget);
    const updated = await updateGoal(db, goalId, {
      version: 1,
      goal: { ...goal, targetProfit: "54321" },
    });
    expect(updated.version).toBe(2);
    await expect(updateGoal(db, goalId, { version: 1, goal })).rejects.toThrow(
      "変更済み",
    );
  });
  it("DBが逆転期間・負数予算・テスト上限0を拒否", async () => {
    for (const data of [
      { sourcingBudget: new Prisma.Decimal("-1") },
      { maxConcurrentTests: 0 },
      { periodEndExclusive: new Date("2020-01-01") },
    ])
      await expect(
        db.goal.update({ where: { id: goalId }, data }),
      ).rejects.toThrow();
  });
  it("参照済み見積は上書き不可", async () => {
    await expect(
      db.supplierProposal.update({
        where: { id: proposalId },
        data: { stock: 1 },
      }),
    ).rejects.toThrow();
  });
  it("候補の次の行動必須", async () => {
    await expect(
      db.candidate.create({
        data: { productId, route: "SUPPLIER", nextAction: " " },
      }),
    ).rejects.toThrow();
  });
  it("参照商品を削除不可", async () => {
    await expect(
      db.product.delete({ where: { id: productId } }),
    ).rejects.toThrow();
  });
  it("DBもASIN形式・照合根拠を検証", async () => {
    await expect(
      db.channelProduct.create({
        data: {
          productId,
          salesChannel: "AMAZON_JP",
          marketplace: "JP",
          externalProductId: "short",
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.channelProduct.update({
        where: { id: channelId },
        data: { matchStatus: "VERIFIED" },
      }),
    ).rejects.toThrow();
  });
  it("eBayは別チャネルとして手動プラン登録できる", async () => {
    const c = (await createRecord(db, "channels", {
      productId,
      salesChannel: "EBAY",
      marketplace: "US",
      externalProductId: "123456789",
      condition: "NEW",
    })) as { id: string };
    const candidate = (await createRecord(db, "candidates", {
      productId,
      channelProductId: c.id,
      route: "MARKET",
      nextAction: "手動出品条件を確認",
    })) as { id: string };
    await createRecord(db, "plans", {
      candidateId: candidate.id,
      supplierProposalId: proposalId,
      quantity: 4,
      fulfillmentMethod: "MANUAL",
    });
    await expect(
      db.sourcingPlan.create({
        data: {
          productId,
          candidateId: candidate.id,
          supplierProposalId: proposalId,
          quantity: 4,
          fulfillmentMethod: "FBA",
        },
      }),
    ).rejects.toThrow();
  });
});
