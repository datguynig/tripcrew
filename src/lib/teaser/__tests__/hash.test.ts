import assert from "node:assert/strict";
import test from "node:test";
import { buildCacheKey, hashIp } from "@/lib/teaser/hash";

test("hashIp throws when IP_HASH_SALT is unset", () => {
  const prev = process.env.IP_HASH_SALT;
  delete process.env.IP_HASH_SALT;
  try {
    assert.throws(() => hashIp("1.2.3.4"), /IP_HASH_SALT not configured/);
  } finally {
    if (prev !== undefined) process.env.IP_HASH_SALT = prev;
  }
});

test("hashIp is deterministic for the same ip + salt", () => {
  process.env.IP_HASH_SALT = "test-salt-fixture";
  const a = hashIp("1.2.3.4");
  const b = hashIp("1.2.3.4");
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test("hashIp differs across different ips with the same salt", () => {
  process.env.IP_HASH_SALT = "test-salt-fixture";
  const a = hashIp("1.2.3.4");
  const b = hashIp("5.6.7.8");
  assert.notEqual(a, b);
});

test("hashIp differs across different salts for the same ip", () => {
  process.env.IP_HASH_SALT = "salt-one";
  const a = hashIp("1.2.3.4");
  process.env.IP_HASH_SALT = "salt-two";
  const b = hashIp("1.2.3.4");
  assert.notEqual(a, b);
});

test("buildCacheKey is deterministic for the same slug + inputs", () => {
  const a = buildCacheKey("bali", '{"origin":"LHR"}');
  const b = buildCacheKey("bali", '{"origin":"LHR"}');
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test("buildCacheKey differs across different slugs", () => {
  const a = buildCacheKey("bali", '{"origin":"LHR"}');
  const b = buildCacheKey("rio", '{"origin":"LHR"}');
  assert.notEqual(a, b);
});

test("buildCacheKey differs across different normalized inputs", () => {
  const a = buildCacheKey("bali", '{"origin":"LHR"}');
  const b = buildCacheKey("bali", '{"origin":"MAN"}');
  assert.notEqual(a, b);
});
