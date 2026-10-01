import { PrismaClient } from "@prisma/client";
import * as input from "./inputs";
import { validateQuantity } from "../domain/quantity";
export class RecordError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
  }
}
export const entities = [
  "products",
  "identifiers",
  "channels",
  "candidates",
  "suppliers",
  "proposals",
  "plans",
  "goals",
] as const;
export type Entity = (typeof entities)[number];
export async function createRecord(
  db: PrismaClient,
  entity: Entity,
  raw: unknown,
) {
  switch (entity) {
    case "products":
      return db.product.create({ data: input.productInput.parse(raw) });
    case "identifiers":
      return db.productIdentifier.create({
        data: input.identifierInput.parse(raw),
      });
    case "channels":
      return db.channelProduct.create({ data: input.channelInput.parse(raw) });
    case "candidates":
      return db.candidate.create({ data: input.candidateInput.parse(raw) });
    case "suppliers":
      return db.supplier.create({ data: input.supplierInput.parse(raw) });
    case "proposals": {
      const { costs, ...data } = input.proposalInput.parse(raw);
      return db.supplierProposal.create({
        data: { ...data, costs: { create: costs } },
        include: { costs: true },
      });
    }
    case "plans": {
      const data = input.planInput.parse(raw);
      return db.$transaction(async (tx) => {
        const candidate = await tx.candidate.findUnique({
          where: { id: data.candidateId },
          include: { channelProduct: true },
        });
        const proposal = await tx.supplierProposal.findUnique({
          where: { id: data.supplierProposalId },
        });
        if (!candidate || !proposal)
          throw new RecordError("候補または仕入提案がありません", 404);
        if (candidate.productId !== proposal.productId)
          throw new RecordError("候補と仕入提案の商品が異なります");
        if (
          candidate.channelProduct?.salesChannel === "EBAY" &&
          data.fulfillmentMethod !== "MANUAL"
        )
          throw new RecordError("eBayの基盤プランはMANUALで登録してください");
        try {
          validateQuantity(data.quantity, proposal);
        } catch (e) {
          throw new RecordError((e as Error).message);
        }
        return tx.sourcingPlan.create({
          data: { ...data, productId: candidate.productId },
        });
      });
    }
    case "goals":
      return db.goal.create({ data: input.goalInput.parse(raw) });
  }
}
export async function listRecords(db: PrismaClient, entity: Entity) {
  const options = { take: 200, orderBy: { createdAt: "desc" as const } };
  switch (entity) {
    case "products":
      return db.product.findMany({
        ...options,
        include: { identifiers: true, channels: true },
      });
    case "identifiers":
      return db.productIdentifier.findMany({
        take: 200,
        orderBy: { id: "asc" },
      });
    case "channels":
      return db.channelProduct.findMany(options);
    case "candidates":
      return db.candidate.findMany({ ...options, include: { product: true } });
    case "suppliers":
      return db.supplier.findMany(options);
    case "proposals":
      return db.supplierProposal.findMany({
        ...options,
        include: { supplier: true, product: true, costs: true },
      });
    case "plans":
      return db.sourcingPlan.findMany({
        ...options,
        include: {
          candidate: { include: { product: true } },
          proposal: { include: { supplier: true } },
        },
      });
    case "goals":
      return db.goal.findMany(options);
  }
}
export async function updateGoal(db: PrismaClient, id: string, raw: unknown) {
  const { version, goal } = input.goalUpdateInput.parse(raw);
  return db.$transaction(async (tx) => {
    const result = await tx.goal.updateMany({
      where: { id, version },
      data: { ...goal, version: { increment: 1 } },
    });
    if (result.count !== 1)
      throw new RecordError(
        "目標が変更済み、または存在しません。再読込してください",
        409,
      );
    return tx.goal.findUniqueOrThrow({ where: { id } });
  });
}
