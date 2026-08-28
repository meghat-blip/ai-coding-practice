import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserByUsername } = vi.hoisted(() => ({
	getUserByUsername: vi.fn(),
}));

vi.mock("@/lib/services/user-service", () => ({
	getUserByUsername,
}));

import { POST } from "@/app/api/auth/login/route";

const passwordHash = "b".repeat(64);
const storedUser = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	username: "ada",
	email: "ada@school.edu",
	passwordHash,
};

function postJson(body: unknown) {
	return POST(
		new Request("http://localhost/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("POST /api/auth/login", () => {
	it("returns 200 and a public user when username and hash match", async () => {
		getUserByUsername.mockResolvedValue(storedUser);

		const response = await postJson({ username: "ada", passwordHash });
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({
			id: "user-1",
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada",
			email: "ada@school.edu",
		});
		expect(getUserByUsername).toHaveBeenCalledWith("ada");
	});

	it("returns 401 with a generic message for unknown user or hash mismatch", async () => {
		getUserByUsername.mockResolvedValue(null);
		const unknown = await postJson({ username: "missing", passwordHash });
		expect(unknown.status).toBe(401);
		await expect(unknown.json()).resolves.toEqual({
			error: "Invalid username or password",
		});

		getUserByUsername.mockResolvedValue({ ...storedUser, passwordHash: "c".repeat(64) });
		const mismatch = await postJson({ username: "ada", passwordHash });
		expect(mismatch.status).toBe(401);
		await expect(mismatch.json()).resolves.toEqual({
			error: "Invalid username or password",
		});
	});

	it("returns 400 for an invalid body", async () => {
		const missing = await postJson({});
		expect(missing.status).toBe(400);

		const badHash = await postJson({ username: "ada", passwordHash: "nope" });
		expect(badHash.status).toBe(400);
		expect(getUserByUsername).not.toHaveBeenCalled();
	});

	it("does not include password fields on success", async () => {
		getUserByUsername.mockResolvedValue(storedUser);

		const json = await (await postJson({ username: "ada", passwordHash })).json();

		expect(json).not.toHaveProperty("password");
		expect(json).not.toHaveProperty("passwordHash");
		expect(json).not.toHaveProperty("password_hash");
	});
});
