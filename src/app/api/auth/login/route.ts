import { getUserByUsername } from "@/lib/services/user-service";
import { jsonError, parseLoginBody, readJsonBody } from "@/lib/auth-http";
import { timingSafeEqual } from "@/lib/password";

export async function POST(request: Request) {
	const input = parseLoginBody(await readJsonBody(request));
	if (!input) {
		return jsonError(400, "Invalid login request");
	}

	try {
		const user = await getUserByUsername(input.username);
		if (!user || !timingSafeEqual(user.passwordHash, input.passwordHash)) {
			return jsonError(401, "Invalid username or password");
		}

		return Response.json({
			id: user.id,
			firstName: user.firstName,
			lastName: user.lastName,
			username: user.username,
			email: user.email,
		});
	} catch {
		return jsonError(500, "Server error");
	}
}
