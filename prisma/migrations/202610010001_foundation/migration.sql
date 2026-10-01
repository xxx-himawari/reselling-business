-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('AMAZON_JP', 'EBAY');

-- CreateEnum
CREATE TYPE "TaxBasis" AS ENUM ('INCLUSIVE', 'EXCLUSIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IdentifierType" AS ENUM ('JAN', 'EAN', 'UPC', 'GTIN');

-- CreateEnum
CREATE TYPE "CandidateRoute" AS ENUM ('SUPPLIER', 'MARKET');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('UNCONFIRMED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "Recommendation" AS ENUM ('NEEDS_CONFIRMATION', 'TEST_NOW', 'BUY_OR_REPLENISH', 'WAIT_CONDITION', 'SKIP');

-- CreateEnum
CREATE TYPE "CostState" AS ENUM ('KNOWN', 'UNKNOWN', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ChargeBasis" AS ENUM ('PER_UNIT', 'PER_ORDER');

-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('DOMESTIC_SHIPPING', 'INTERNATIONAL_SHIPPING', 'CUSTOMS', 'IMPORT_TAX', 'PAYMENT_FEE', 'FX_FEE', 'CUSTOMS_CLEARANCE', 'INSPECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('UNKNOWN', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "FulfillmentMethod" AS ENUM ('FBA', 'FBM', 'MANUAL');

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "manufacturer" TEXT,
    "category" TEXT,
    "variant" TEXT,
    "packQuantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductIdentifier" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "type" "IdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ProductIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelProduct" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "salesChannel" "SalesChannel" NOT NULL,
    "marketplace" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'NEW',
    "matchStatus" "MatchStatus" NOT NULL DEFAULT 'UNCONFIRMED',
    "matchEvidence" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "channelProductId" UUID,
    "route" "CandidateRoute" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "recommendation" "Recommendation" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    "nextAction" TEXT NOT NULL,
    "nextActionDueAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MANUAL',
    "country" TEXT NOT NULL DEFAULT 'JP',
    "url" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProposal" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "supplierProductCode" TEXT,
    "unitCost" DECIMAL(20,6) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'JPY',
    "taxBasis" "TaxBasis" NOT NULL DEFAULT 'UNKNOWN',
    "moq" INTEGER NOT NULL DEFAULT 1,
    "orderMultiple" INTEGER NOT NULL DEFAULT 1,
    "quantityMin" INTEGER NOT NULL DEFAULT 1,
    "quantityMax" INTEGER,
    "stock" INTEGER,
    "leadTimeDays" INTEGER,
    "returnTerms" TEXT,
    "defectTerms" TEXT,
    "directShipAllowed" BOOLEAN,
    "source" TEXT NOT NULL,
    "confidence" "Confidence" NOT NULL DEFAULT 'UNKNOWN',
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "validUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalCost" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "type" "CostType" NOT NULL,
    "amount" DECIMAL(20,6),
    "currency" VARCHAR(3) NOT NULL,
    "taxBasis" "TaxBasis" NOT NULL DEFAULT 'UNKNOWN',
    "state" "CostState" NOT NULL,
    "chargeBasis" "ChargeBasis" NOT NULL,
    "source" TEXT,

    CONSTRAINT "ProposalCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcingPlan" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "supplierProposalId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "fulfillmentMethod" "FulfillmentMethod" NOT NULL,
    "targetSaleStart" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourcingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "targetProfit" DECIMAL(20,6) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'JPY',
    "periodStart" TIMESTAMPTZ(3) NOT NULL,
    "periodEndExclusive" TIMESTAMPTZ(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tokyo',
    "profitBasis" TEXT NOT NULL DEFAULT 'BUSINESS_PROFIT',
    "sourcingBudget" DECIMAL(20,6) NOT NULL,
    "maxLossPerProduct" DECIMAL(20,6) NOT NULL,
    "maxConcurrentTests" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductIdentifier_productId_idx" ON "ProductIdentifier"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductIdentifier_type_value_key" ON "ProductIdentifier"("type", "value");

-- CreateIndex
CREATE INDEX "ChannelProduct_productId_idx" ON "ChannelProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelProduct_salesChannel_marketplace_externalProductId_c_key" ON "ChannelProduct"("salesChannel", "marketplace", "externalProductId", "condition");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelProduct_id_productId_key" ON "ChannelProduct"("id", "productId");

-- CreateIndex
CREATE INDEX "Candidate_productId_idx" ON "Candidate"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_id_productId_key" ON "Candidate"("id", "productId");

-- CreateIndex
CREATE INDEX "SupplierProposal_productId_supplierId_idx" ON "SupplierProposal"("productId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProposal_id_productId_key" ON "SupplierProposal"("id", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProposal_id_currency_key" ON "SupplierProposal"("id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalCost_proposalId_type_key" ON "ProposalCost"("proposalId", "type");

-- CreateIndex
CREATE INDEX "SourcingPlan_supplierProposalId_idx" ON "SourcingPlan"("supplierProposalId");

-- CreateIndex
CREATE UNIQUE INDEX "SourcingPlan_candidateId_supplierProposalId_quantity_fulfil_key" ON "SourcingPlan"("candidateId", "supplierProposalId", "quantity", "fulfillmentMethod");

-- AddForeignKey
ALTER TABLE "ProductIdentifier" ADD CONSTRAINT "ProductIdentifier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelProduct" ADD CONSTRAINT "ChannelProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_channelProductId_productId_fkey" FOREIGN KEY ("channelProductId", "productId") REFERENCES "ChannelProduct"("id", "productId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SupplierProposal" ADD CONSTRAINT "SupplierProposal_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProposal" ADD CONSTRAINT "SupplierProposal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalCost" ADD CONSTRAINT "ProposalCost_proposalId_currency_fkey" FOREIGN KEY ("proposalId", "currency") REFERENCES "SupplierProposal"("id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SourcingPlan" ADD CONSTRAINT "SourcingPlan_candidateId_productId_fkey" FOREIGN KEY ("candidateId", "productId") REFERENCES "Candidate"("id", "productId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SourcingPlan" ADD CONSTRAINT "SourcingPlan_supplierProposalId_productId_fkey" FOREIGN KEY ("supplierProposalId", "productId") REFERENCES "SupplierProposal"("id", "productId") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Business invariants also apply to imports and direct SQL writes.
ALTER TABLE "Product" ADD CONSTRAINT "Product_positive_pack" CHECK ("packQuantity" > 0), ADD CONSTRAINT "Product_name_nonempty" CHECK (length(btrim("name")) > 0);
ALTER TABLE "ProductIdentifier" ADD CONSTRAINT "Identifier_format" CHECK (
 "value" ~ '^[0-9]+$' AND (
 ("type" IN ('JAN','EAN') AND length("value") IN (8,13)) OR
 ("type" = 'UPC' AND length("value") = 12) OR
 ("type" = 'GTIN' AND length("value") IN (8,12,13,14))));
ALTER TABLE "ChannelProduct" ADD CONSTRAINT "Amazon_identifier" CHECK ("salesChannel" <> 'AMAZON_JP' OR ("marketplace"='JP' AND "externalProductId" ~ '^[A-Z0-9]{10}$')),
 ADD CONSTRAINT "Verified_match_evidence" CHECK ("matchStatus" <> 'VERIFIED' OR length(btrim(coalesce("matchEvidence",''))) > 0);
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_next_action" CHECK (NOT "active" OR length(btrim("nextAction")) > 0);
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_name_nonempty" CHECK (length(btrim("name")) > 0), ADD CONSTRAINT "Supplier_country" CHECK ("country" ~ '^[A-Z]{2}$');
ALTER TABLE "SupplierProposal" ADD CONSTRAINT "Proposal_money" CHECK ("unitCost" >= 0 AND "currency" ~ '^[A-Z]{3}$'),
 ADD CONSTRAINT "Proposal_quantity_terms" CHECK ("moq">0 AND "orderMultiple">0 AND "quantityMin">0 AND ("quantityMax" IS NULL OR "quantityMax">=greatest("quantityMin","moq")) AND ("stock" IS NULL OR "stock">=0)),
 ADD CONSTRAINT "Proposal_lead_time" CHECK ("leadTimeDays" IS NULL OR "leadTimeDays">=0),
 ADD CONSTRAINT "Proposal_timestamps" CHECK ("observedAt" <= "fetchedAt" AND ("validUntil" IS NULL OR "validUntil">="observedAt")),
 ADD CONSTRAINT "Proposal_source" CHECK (length(btrim("source"))>0);
ALTER TABLE "ProposalCost" ADD CONSTRAINT "Cost_state_amount" CHECK (("state"='KNOWN' AND "amount" IS NOT NULL AND "amount">=0) OR ("state"<>'KNOWN' AND "amount" IS NULL));
ALTER TABLE "SourcingPlan" ADD CONSTRAINT "Plan_quantity_positive" CHECK ("quantity">0);
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_limits" CHECK ("targetProfit">=0 AND "sourcingBudget">=0 AND "maxLossPerProduct">=0 AND "maxConcurrentTests">0 AND "version">0),
 ADD CONSTRAINT "Goal_period" CHECK ("periodStart" < "periodEndExclusive"),
 ADD CONSTRAINT "Goal_currency" CHECK ("currency" ~ '^[A-Z]{3}$'),
 ADD CONSTRAINT "Goal_timezone" CHECK ("timezone"='Asia/Tokyo'),
 ADD CONSTRAINT "Goal_profit_basis" CHECK ("profitBasis" IN ('BUSINESS_PROFIT','PRODUCT_PROFIT'));

CREATE FUNCTION validate_sourcing_quantity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "SupplierProposal"; channel "SalesChannel";
BEGIN
 SELECT * INTO STRICT p FROM "SupplierProposal" WHERE "id"=NEW."supplierProposalId" FOR SHARE;
 IF NEW."quantity" < greatest(p."moq",p."quantityMin") OR NEW."quantity" % p."orderMultiple" <> 0
 OR (p."quantityMax" IS NOT NULL AND NEW."quantity">p."quantityMax")
 OR (p."stock" IS NOT NULL AND NEW."quantity">p."stock") THEN
  RAISE EXCEPTION 'Sourcing quantity violates proposal terms' USING ERRCODE='23514';
 END IF;
 SELECT cp."salesChannel" INTO channel FROM "Candidate" c LEFT JOIN "ChannelProduct" cp ON cp."id"=c."channelProductId" WHERE c."id"=NEW."candidateId";
 IF channel='EBAY' AND NEW."fulfillmentMethod"<>'MANUAL' THEN
  RAISE EXCEPTION 'eBay plans require MANUAL fulfillment' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "SourcingPlan_quantity_terms" BEFORE INSERT OR UPDATE ON "SourcingPlan" FOR EACH ROW EXECUTE FUNCTION validate_sourcing_quantity();

-- Quotes are revised as new records, so existing quantity plans keep their basis.
CREATE FUNCTION protect_plan_basis() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='SupplierProposal' AND EXISTS(SELECT 1 FROM "SourcingPlan" WHERE "supplierProposalId"=OLD."id") THEN
  RAISE EXCEPTION 'Create a new proposal revision for referenced quotes' USING ERRCODE='23514';
 END IF;
 IF TG_TABLE_NAME='Candidate' THEN
 IF (NEW."productId" IS DISTINCT FROM OLD."productId" OR NEW."channelProductId" IS DISTINCT FROM OLD."channelProductId")
 AND EXISTS(SELECT 1 FROM "SourcingPlan" WHERE "candidateId"=OLD."id") THEN
  RAISE EXCEPTION 'Cannot change the product/channel basis of existing plans' USING ERRCODE='23514';
 END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Proposal_referenced_immutable" BEFORE UPDATE ON "SupplierProposal" FOR EACH ROW EXECUTE FUNCTION protect_plan_basis();
CREATE TRIGGER "Candidate_plan_basis" BEFORE UPDATE ON "Candidate" FOR EACH ROW EXECUTE FUNCTION protect_plan_basis();
