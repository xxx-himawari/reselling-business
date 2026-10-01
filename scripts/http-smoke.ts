import assert from "node:assert/strict";
const base = process.env.SMOKE_BASE_URL!;
async function request(
  path: string,
  data?: unknown,
  method = "POST",
  expected = data === undefined ? 200 : 201,
) {
  const r = await fetch(
    `${base}/api/${path}`,
    data === undefined
      ? {}
      : {
          method,
          headers: { "Content-Type": "application/json", Origin: base },
          body: JSON.stringify(data),
        },
  );
  const body = await r.json();
  assert.equal(r.status, expected, JSON.stringify(body));
  return body;
}
async function main() {
  const product = await request("products", {
    name: "HTTP manually registered product",
  });
  await request("identifiers", {
    productId: product.id,
    type: "JAN",
    value: "0987654321098",
    source: "smoke",
  });
  const channel = await request("channels", {
    productId: product.id,
    salesChannel: "AMAZON_JP",
    marketplace: "JP",
    externalProductId: "B000000002",
  });
  const candidate = await request("candidates", {
    productId: product.id,
    channelProductId: channel.id,
    route: "SUPPLIER",
    nextAction: "条件を確認",
  });
  const supplier = await request("suppliers", { name: "HTTP supplier" });
  const quote = {
    productId: product.id,
    supplierId: supplier.id,
    unitCost: "0.1",
    moq: 3,
    source: "smoke",
    observedAt: "2026-10-01T00:00:00Z",
    fetchedAt: "2026-10-01T00:00:00Z",
    costs: [
      {
        type: "DOMESTIC_SHIPPING",
        amount: "0.2",
        state: "KNOWN",
        chargeBasis: "PER_ORDER",
      },
    ],
  };
  const proposal = await request("proposals", quote);
  assert.equal(proposal.unitCost, "0.1");
  assert.equal(proposal.costs[0].amount, "0.2");
  await request("plans", {
    candidateId: candidate.id,
    supplierProposalId: proposal.id,
    quantity: 3,
    fulfillmentMethod: "FBA",
  });
  await request("plans", {
    candidateId: candidate.id,
    supplierProposalId: proposal.id,
    quantity: 5,
    fulfillmentMethod: "FBA",
  });
  await request(
    "plans",
    {
      candidateId: candidate.id,
      supplierProposalId: proposal.id,
      quantity: 2,
      fulfillmentMethod: "FBA",
    },
    "POST",
    422,
  );
  await request("proposals", { ...quote, unitCost: 0.1 }, "POST", 400);
  const goal = {
    name: "HTTP goal",
    targetProfit: "43210",
    sourcingBudget: "100000",
    maxLossPerProduct: "1000",
    maxConcurrentTests: 1,
    periodStart: "2026-10-01T00:00:00+09:00",
    periodEndExclusive: "2027-01-01T00:00:00+09:00",
  };
  const g = await request("goals", goal);
  await request(
    `goals/${g.id}`,
    { version: 1, goal: { ...goal, targetProfit: "12345" } },
    "PATCH",
    200,
  );
  await request(`goals/${g.id}`, { version: 1, goal }, "PATCH", 409);
  const products = await request("products");
  assert.ok(products.some((p: { id: string }) => p.id === product.id));
  const denied = await fetch(`${base}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://example.com",
    },
    body: JSON.stringify({ name: "denied" }),
  });
  assert.equal(denied.status, 403);
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes("小さく仕入れ"));
  console.log(
    "PASS: production HTTP registration flow, money strings, quantity errors, goal update, CSRF and page response",
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
