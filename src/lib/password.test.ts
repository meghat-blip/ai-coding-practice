import { describe, expect, it } from "vitest";
import { isSha256Hex, sha256Hex } from "@/lib/password";

describe("sha256Hex", () => {
	it("returns a 64-character lowercase hex digest", async () => {
		const digest = await sha256Hex("correct-horse-battery");
		expect(digest).toMatch(/^[a-f0-9]{64}$/);
	});

	it("returns the same digest for the same input", async () => {
		const a = await sha256Hex("same-password");
		const b = await sha256Hex("same-password");
		expect(a).toBe(b);
	});

	it("returns a different digest for a different input", async () => {
		const a = await sha256Hex("password-one");
		const b = await sha256Hex("password-two");
		expect(a).not.toBe(b);
	});
});

describe("isSha256Hex", () => {
	it("accepts a valid SHA-256 hex digest", async () => {
		const digest = await sha256Hex("valid-password");
		expect(isSha256Hex(digest)).toBe(true);
	});

	it("rejects plaintext, empty, wrong-length, and non-hex values", () => {
		expect(isSha256Hex("plaintext-password")).toBe(false);
		expect(isSha256Hex("")).toBe(false);
		expect(isSha256Hex("abc")).toBe(false);
		expect(isSha256Hex("g".repeat(64))).toBe(false);
		expect(isSha256Hex("A".repeat(64))).toBe(false);
	});
});
