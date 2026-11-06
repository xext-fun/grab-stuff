const test = require("node:test");
const assert = require("node:assert/strict");
const { parseStatusUrl, parseHandleList, matchesHandle, addUnique } = require("../src/core.js");

test("parses X and Twitter status links and rejects other hosts", () => {
  assert.deepEqual(parseStatusUrl("https://twitter.com/alice/status/123?s=20"), {
    id: "123", username: "alice", url: "https://x.com/alice/status/123"
  });
  assert.equal(parseStatusUrl("https://example.com/alice/status/123"), null);
});

test("deduplicates by status ID across repeated and alternate links", () => {
  const first = { url: "https://x.com/alice/status/123", text: "hello" };
  const again = { url: "https://twitter.com/alice/status/123?s=20", text: "hello again" };
  const second = { url: "https://x.com/bob/status/456", text: "world" };
  const result = addUnique([first], [again, second, second]);
  assert.equal(result.added, 1);
  assert.deepEqual(result.posts.map(post => post.id), ["123", "456"]);
  assert.equal(result.posts[0].text, "hello");
});

test("imports TXT handles and profile URLs without case-sensitive duplicates", () => {
  assert.deepEqual(parseHandleList("@Alice\nbob\nhttps://x.com/ALICE\ninvalid-handle", "people.txt"),
    ["alice", "bob"]);
  assert.equal(matchesHandle({ username: "ALICE" }, ["alice", "bob"]), true);
  assert.equal(matchesHandle({ username: "charlie" }, ["alice", "bob"]), false);
  assert.equal(matchesHandle({ username: "charlie" }, []), true);
});

test("imports the named handle column from CSV", () => {
  assert.deepEqual(parseHandleList('name,handle\n"Alice, A.",@Alice\nBob,https://twitter.com/Bob\n', "people.csv"),
    ["alice", "bob"]);
});
