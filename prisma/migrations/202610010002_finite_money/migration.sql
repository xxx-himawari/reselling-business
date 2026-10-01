-- PostgreSQL numeric NaN compares greater than ordinary values, so >= 0 alone
-- is not a finite-money constraint. Preserve the initial migration checksum.
ALTER TABLE "SupplierProposal" ADD CONSTRAINT "Proposal_finite_money" CHECK ("unitCost" <> 'NaN'::numeric);
ALTER TABLE "ProposalCost" ADD CONSTRAINT "Cost_finite_money" CHECK ("amount" IS NULL OR "amount" <> 'NaN'::numeric);
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_finite_money" CHECK (
 "targetProfit" <> 'NaN'::numeric AND "sourcingBudget" <> 'NaN'::numeric AND "maxLossPerProduct" <> 'NaN'::numeric);
