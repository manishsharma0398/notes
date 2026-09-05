"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { loadAuth } = require("./_helpers");
const { sign, verify } = loadAuth();

// Phase 1 needs no Redis — it exists to prove why Redis is needed.
const SECRET = "test-secret";

test("phase 1: a valid token verifies and returns its payload", () => {
  const token = sign({ sub: "u1" }, SECRET);
  const payload = verify(token, SECRET);
  assert.strictEqual(payload.sub, "u1");
});

test("phase 1: a tampered payload fails", () => {
  const token = sign({ sub: "u1", role: "user" }, SECRET);
  const [h, , s] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "u1", role: "admin" })).toString("base64url");
  assert.throws(() => verify(`${h}.${forged}.${s}`, SECRET));
});

test("phase 1: a tampered signature fails", () => {
  const [h, p] = sign({ sub: "u1" }, SECRET).split(".");
  assert.throws(() => verify(`${h}.${p}.bm90LWEtc2ln`, SECRET));
});

test("phase 1: the wrong secret fails", () => {
  assert.throws(() => verify(sign({ sub: "u1" }, SECRET), "other-secret"));
});

test("phase 1: alg 'none' is rejected", () => {
  const h = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify({ sub: "attacker" })).toString("base64url");
  assert.throws(() => verify(`${h}.${p}.`, SECRET), "the token must not choose its own algorithm");
});

test("phase 1: the header's alg is VALIDATED, not ignored", () => {
  // The real shape of the alg attack. This token claims HS512 but is signed with
  // HMAC-SHA256 — exactly what a verifier that hardcodes SHA-256 and never reads
  // header.alg will compute. Such a verifier accepts this. A correct one rejects
  // it on the algorithm before ever comparing signatures.
  const crypto = require("node:crypto");
  const h = Buffer.from(JSON.stringify({ alg: "HS512", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify({ sub: "attacker" })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  assert.throws(() => verify(`${h}.${p}.${sig}`, SECRET), "you must reject an alg you did not choose");
});

test("phase 1: an expired token fails DISTINGUISHABLY from an invalid one", () => {
  const expired = sign({ sub: "u1", exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
  let expiredErr, invalidErr;
  try { verify(expired, SECRET); } catch (e) { expiredErr = e; }
  try { verify(sign({ sub: "u1" }, SECRET), "wrong"); } catch (e) { invalidErr = e; }
  assert.ok(expiredErr, "expired must throw");
  assert.ok(invalidErr, "invalid must throw");
  assert.notStrictEqual(
    expiredErr.code ?? expiredErr.name ?? expiredErr.message,
    invalidErr.code ?? invalidErr.name ?? invalidErr.message,
    "the caller must tell 'log in again' from 'something is wrong'",
  );
});

test("phase 1: THE PUNCHLINE — a valid token cannot be revoked", () => {
  const token = sign({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 900 }, SECRET);
  assert.ok(verify(token, SECRET), "still valid, and nothing you can do here changes that");
  // There is no revoke() to call. That absence is the entire justification for phases 2-7.
});
