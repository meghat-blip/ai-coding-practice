import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
	const bind = vi.fn();
	const all = vi.fn();
	const run = vi.fn();
	const prepare = vi.fn(() => ({
		bind: (...args: unknown[]) => {
			bind(...args);
			return { all, run };
		},
	}));
	return { mockDb: { prepare, bind, all, run } };
});

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(async () => ({
		env: { DB: mockDb },
	})),
}));

import {
	createUser,
	deleteUser,
	getUserByUsername,
	updateUser,
	UserConflictError,
} from "@/lib/services/user-service";

const ada = {
	firstName: "Ada",
	lastName: "Lovelace",
	username: "ada@school.edu",
	email: "ada@school.edu",
	passwordHash: "a".repeat(64),
};

const adaRow = {
	id: "user-1",
	first_name: "Ada",
	last_name: "Lovelace",
	username: "ada@school.edu",
	email: "ada@school.edu",
	password_hash: ada.passwordHash,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createUser", () => {
	it("inserts bound fields and returns a PublicUser without passwordHash", async () => {
		mockDb.all.mockResolvedValue({
			results: [
				{
					id: adaRow.id,
					first_name: adaRow.first_name,
					last_name: adaRow.last_name,
					username: adaRow.username,
					email: adaRow.email,
				},
			],
		});

		const user = await createUser(ada);

		expect(mockDb.prepare).toHaveBeenCalled();
		const sql = String(mockDb.prepare.mock.calls[0]?.[0]);
		expect(sql).toMatch(/INSERT INTO users/i);
		expect(mockDb.bind).toHaveBeenCalledWith(
			ada.firstName,
			ada.lastName,
			ada.username,
			ada.email,
			ada.passwordHash,
		);
		expect(user).toEqual({
			id: "user-1",
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada@school.edu",
			email: "ada@school.edu",
		});
		expect(user).not.toHaveProperty("passwordHash");
	});

	it("succeeds when username and email are the same string", async () => {
		mockDb.all.mockResolvedValue({
			results: [
				{
					id: adaRow.id,
					first_name: adaRow.first_name,
					last_name: adaRow.last_name,
					username: ada.username,
					email: ada.email,
				},
			],
		});

		const user = await createUser(ada);
		expect(user.username).toBe(user.email);
		expect(mockDb.bind.mock.calls[0]?.[2]).toBe(mockDb.bind.mock.calls[0]?.[3]);
	});

	it("throws UserConflictError when username or email is already taken", async () => {
		mockDb.all.mockRejectedValue(new Error("UNIQUE constraint failed: users.username"));

		await expect(createUser(ada)).rejects.toBeInstanceOf(UserConflictError);
	});
});

describe("getUserByUsername", () => {
	it("returns the stored hash for password comparison", async () => {
		mockDb.all.mockResolvedValue({ results: [adaRow] });

		const record = await getUserByUsername(ada.username);

		expect(mockDb.bind).toHaveBeenCalledWith(ada.username);
		expect(record).toEqual({
			id: "user-1",
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada@school.edu",
			email: "ada@school.edu",
			passwordHash: ada.passwordHash,
		});
	});

	it("returns null when no user matches", async () => {
		mockDb.all.mockResolvedValue({ results: [] });

		await expect(getUserByUsername("missing")).resolves.toBeNull();
	});
});

describe("updateUser", () => {
	it("updates allowed fields and updated_at", async () => {
		mockDb.all.mockResolvedValue({
			results: [
				{
					id: adaRow.id,
					first_name: "Augusta",
					last_name: "Byron",
					username: ada.username,
					email: ada.email,
				},
			],
		});

		const user = await updateUser("user-1", { firstName: "Augusta", lastName: "Byron" });

		const sql = String(mockDb.prepare.mock.calls[0]?.[0]);
		expect(sql).toMatch(/UPDATE users/i);
		expect(sql).toMatch(/updated_at/i);
		expect(mockDb.bind).toHaveBeenCalled();
		expect(mockDb.bind.mock.calls[0]).toContain("Augusta");
		expect(mockDb.bind.mock.calls[0]).toContain("Byron");
		expect(mockDb.bind.mock.calls[0]).toContain("user-1");
		expect(user).toEqual({
			id: "user-1",
			firstName: "Augusta",
			lastName: "Byron",
			username: "ada@school.edu",
			email: "ada@school.edu",
		});
	});
});

describe("deleteUser", () => {
	it("removes the row so a later lookup returns null", async () => {
		mockDb.run.mockResolvedValue({ success: true });
		mockDb.all.mockResolvedValue({ results: [] });

		await deleteUser("user-1");

		const sql = String(mockDb.prepare.mock.calls[0]?.[0]);
		expect(sql).toMatch(/DELETE FROM users/i);
		expect(mockDb.bind).toHaveBeenCalledWith("user-1");
		await expect(getUserByUsername(ada.username)).resolves.toBeNull();
	});
});
