import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/logout/route";

describe("POST /api/auth/logout", () => {
	it("returns 200 { ok: true } without requiring a body", async () => {
		const response = await POST(
			new Request("http://localhost/api/auth/logout", { method: "POST" }),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ ok: true });
	});
});
