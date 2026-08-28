import { beforeEach, describe, expect, it, vi } from "vitest";

const { createUser, UserConflictError } = vi.hoisted(() => {
	class UserConflictError extends Error {
		constructor(message = "Username or email already taken") {
			super(message);
			this.name = "UserConflictError";
		}
	}
	return { createUser: vi.fn(), UserConflictError };
});

vi.mock("@/lib/services/user-service", () => ({
	UserConflictError,
	createUser,
}));

import { POST } from "@/app/api/auth/register/route";

const validBody = {
	firstName: "Ada",
	lastName: "Lovelace",
	username: "ada@school.edu",
	email: "ada@school.edu",
	passwordHash: "a".repeat(64),
};

const publicUser = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	username: "ada@school.edu",
	email: "ada@school.edu",
};

function postJson(body: unknown) {
	return POST(
		new Request("http://localhost/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("POST /api/auth/register", () => {
	it("returns 201 and a public user, passing passwordHash to createUser", async () => {
		createUser.mockResolvedValue(publicUser);

		const response = await postJson(validBody);
		const json = await response.json();

		expect(response.status).toBe(201);
		expect(json).toEqual(publicUser);
		expect(createUser).toHaveBeenCalledWith(validBody);
	});

	it("returns 201 when username and email are the same string", async () => {
		createUser.mockResolvedValue(publicUser);

		const response = await postJson(validBody);

		expect(response.status).toBe(201);
		expect(createUser).toHaveBeenCalledWith(
			expect.objectContaining({
				username: "ada@school.edu",
				email: "ada@school.edu",
			}),
		);
	});

	it("returns 400 and does not call createUser when fields are missing or passwordHash is not SHA-256 hex", async () => {
		const missing = await postJson({ ...validBody, firstName: "" });
		expect(missing.status).toBe(400);
		expect(createUser).not.toHaveBeenCalled();

		const badHash = await postJson({ ...validBody, passwordHash: "plaintext" });
		expect(badHash.status).toBe(400);
		expect(createUser).not.toHaveBeenCalled();
	});

	it("returns 409 when the user service reports a duplicate identity", async () => {
		createUser.mockRejectedValue(new UserConflictError());

		const response = await postJson(validBody);

		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toEqual({
			error: "Username or email already taken",
		});
	});

	it("does not include password fields on success", async () => {
		createUser.mockResolvedValue(publicUser);

		const json = await (await postJson(validBody)).json();

		expect(json).not.toHaveProperty("password");
		expect(json).not.toHaveProperty("passwordHash");
		expect(json).not.toHaveProperty("password_hash");
	});
});
