import { getCloudflareContext } from "@opennextjs/cloudflare";

export class UserConflictError extends Error {
	constructor(message = "Username or email already taken") {
		super(message);
		this.name = "UserConflictError";
	}
}

export class UserNotFoundError extends Error {
	constructor(message = "User not found") {
		super(message);
		this.name = "UserNotFoundError";
	}
}

export type PublicUser = {
	id: string;
	firstName: string;
	lastName: string;
	username: string;
	email: string;
};

export type UserRecord = PublicUser & {
	passwordHash: string;
};

export type CreateUserInput = {
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	passwordHash: string;
};

export type UpdateUserInput = {
	firstName?: string;
	lastName?: string;
	username?: string;
	email?: string;
	passwordHash?: string;
};

type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	username: string;
	email: string;
	password_hash?: string;
};

async function getDb() {
	const { env } = await getCloudflareContext({ async: true });
	return env.DB;
}

function isUniqueConstraintError(error: unknown): boolean {
	return error instanceof Error && error.message.toUpperCase().includes("UNIQUE");
}

function toPublicUser(row: UserRow): PublicUser {
	return {
		id: row.id,
		firstName: row.first_name,
		lastName: row.last_name,
		username: row.username,
		email: row.email,
	};
}

function toUserRecord(row: UserRow): UserRecord {
	return {
		...toPublicUser(row),
		passwordHash: row.password_hash ?? "",
	};
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
	const db = await getDb();
	try {
		const { results } = await db
			.prepare(
				`INSERT INTO users (first_name, last_name, username, email, password_hash)
				 VALUES (?1, ?2, ?3, ?4, ?5)
				 RETURNING id, first_name, last_name, username, email`,
			)
			.bind(input.firstName, input.lastName, input.username, input.email, input.passwordHash)
			.all<UserRow>();

		const row = results[0];
		if (!row) {
			throw new Error("Failed to create user");
		}
		return toPublicUser(row);
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			throw new UserConflictError();
		}
		throw error;
	}
}

export async function getUserByUsername(username: string): Promise<UserRecord | null> {
	const db = await getDb();
	const { results } = await db
		.prepare(
			`SELECT id, first_name, last_name, username, email, password_hash
			 FROM users
			 WHERE username = ?1`,
		)
		.bind(username)
		.all<UserRow>();

	const row = results[0];
	return row ? toUserRecord(row) : null;
}

export async function updateUser(id: string, fields: UpdateUserInput): Promise<PublicUser> {
	const db = await getDb();
	const setClauses: string[] = [];
	const values: string[] = [];

	if (fields.firstName !== undefined) {
		setClauses.push(`first_name = ?${values.length + 1}`);
		values.push(fields.firstName);
	}
	if (fields.lastName !== undefined) {
		setClauses.push(`last_name = ?${values.length + 1}`);
		values.push(fields.lastName);
	}
	if (fields.username !== undefined) {
		setClauses.push(`username = ?${values.length + 1}`);
		values.push(fields.username);
	}
	if (fields.email !== undefined) {
		setClauses.push(`email = ?${values.length + 1}`);
		values.push(fields.email);
	}
	if (fields.passwordHash !== undefined) {
		setClauses.push(`password_hash = ?${values.length + 1}`);
		values.push(fields.passwordHash);
	}

	setClauses.push("updated_at = CURRENT_TIMESTAMP");
	const idPlaceholder = `?${values.length + 1}`;
	values.push(id);

	try {
		const { results } = await db
			.prepare(
				`UPDATE users
				 SET ${setClauses.join(", ")}
				 WHERE id = ${idPlaceholder}
				 RETURNING id, first_name, last_name, username, email`,
			)
			.bind(...values)
			.all<UserRow>();

		const row = results[0];
		if (!row) {
			throw new UserNotFoundError();
		}
		return toPublicUser(row);
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			throw new UserConflictError();
		}
		throw error;
	}
}

export async function deleteUser(id: string): Promise<void> {
	const db = await getDb();
	await db.prepare("DELETE FROM users WHERE id = ?1").bind(id).run();
}
