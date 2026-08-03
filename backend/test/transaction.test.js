const test = require("node:test");
const assert = require("node:assert/strict");
const { withTransaction } = require("../src/database/transaction");

test("withTransaction keeps all work on one client and commits", async () => {
  const calls = [];
  const client = { query: async (sql) => { calls.push(sql); return { rows: [] }; } };
  const result = await withTransaction(async (transactionClient) => {
    assert.equal(transactionClient, client);
    await transactionClient.query("INSERT INTO example VALUES (1)");
    return "done";
  }, { client, isolationLevel: "serializable" });
  assert.equal(result, "done");
  assert.deepEqual(calls, ["BEGIN", "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE", "INSERT INTO example VALUES (1)", "COMMIT"]);
});

test("withTransaction rolls back and preserves the original failure", async () => {
  const calls = [];
  const client = { query: async (sql) => { calls.push(sql); } };
  await assert.rejects(() => withTransaction(async () => { throw new Error("write failed"); }, { client }), /write failed/);
  assert.deepEqual(calls, ["BEGIN", "ROLLBACK"]);
});
