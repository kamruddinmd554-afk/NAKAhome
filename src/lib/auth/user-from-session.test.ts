import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isNullSubError, readSub, userFromSessionRecord } from "./session-user.ts";

describe("userFromSessionRecord", () => {
  it("returns null for null, undefined, and empty session payloads", () => {
    assert.equal(userFromSessionRecord(null), null);
    assert.equal(userFromSessionRecord(undefined), null);
    assert.equal(userFromSessionRecord({}), null);
    assert.equal(userFromSessionRecord({ user: null }), null);
    assert.equal(userFromSessionRecord({ session: null, user: null }), null);
  });

  it("does not throw when sub is missing", () => {
    assert.equal(readSub(null), null);
    assert.equal(readSub(undefined), null);
    assert.equal(readSub({ id: "u1" }), null);
    assert.doesNotThrow(() => userFromSessionRecord(null));
  });

  it("accepts id or sub from a signed-in user", () => {
    assert.equal(userFromSessionRecord({ id: "u1", name: "A" })?.id, "u1");
    assert.equal(userFromSessionRecord({ sub: "u2", email: "a@b.c" })?.id, "u2");
    assert.equal(userFromSessionRecord({ user: { id: "u3" } })?.id, "u3");
  });
});

describe("isNullSubError", () => {
  it("detects the browser TypeError from null.sub", () => {
    assert.equal(isNullSubError(new TypeError("Cannot read properties of null (reading 'sub')")), true);
    assert.equal(isNullSubError(new TypeError("Cannot read property 'sub' of null")), true);
    assert.equal(isNullSubError(new Error("Unauthorized")), false);
  });
});
