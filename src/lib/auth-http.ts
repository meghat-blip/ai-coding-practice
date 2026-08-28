import { isSha256Hex } from "@/lib/password";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT = 255;

export function jsonError(status: number, error: string) {
	return Response.json({ error }, { status });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
	try {
		const body: unknown = await request.json();
		if (typeof body !== "object" || body === null || Array.isArray(body)) {
			return null;
		}
		return body as Record<string, unknown>;
	} catch {
		return null;
	}
}

function readString(body: Record<string, unknown>, key: string): string | null {
	const value = body[key];
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	if (!trimmed || trimmed.length > MAX_TEXT) {
		return null;
	}
	return trimmed;
}

export type RegisterInput = {
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	passwordHash: string;
};

export function parseRegisterBody(body: Record<string, unknown> | null): RegisterInput | null {
	if (!body) {
		return null;
	}
	const firstName = readString(body, "firstName");
	const lastName = readString(body, "lastName");
	const username = readString(body, "username");
	const email = readString(body, "email");
	const passwordHash = readString(body, "passwordHash");
	if (!firstName || !lastName || !username || !email || !passwordHash) {
		return null;
	}
	if (!EMAIL.test(email) || !isSha256Hex(passwordHash)) {
		return null;
	}
	return { firstName, lastName, username, email, passwordHash };
}

export type LoginInput = {
	username: string;
	passwordHash: string;
};

export function parseLoginBody(body: Record<string, unknown> | null): LoginInput | null {
	if (!body) {
		return null;
	}
	const username = readString(body, "username");
	const passwordHash = readString(body, "passwordHash");
	if (!username || !passwordHash || !isSha256Hex(passwordHash)) {
		return null;
	}
	return { username, passwordHash };
}
