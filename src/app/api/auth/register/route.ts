import { createUser, UserConflictError } from "@/lib/services/user-service";
import { jsonError, parseRegisterBody, readJsonBody } from "@/lib/auth-http";

export async function POST(request: Request) {
	const input = parseRegisterBody(await readJsonBody(request));
	if (!input) {
		return jsonError(400, "Invalid registration request");
	}

	try {
		const user = await createUser(input);
		return Response.json(user, { status: 201 });
	} catch (error) {
		if (error instanceof UserConflictError) {
			return jsonError(409, error.message);
		}
		return jsonError(500, "Server error");
	}
}
