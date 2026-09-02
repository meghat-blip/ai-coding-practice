import { createMcq, listMcqs } from "@/lib/services/mcq-service";
import { jsonError, mapMcqError, parseCreateMcqBody, readJsonBody } from "@/lib/mcq-http";

export async function GET() {
	try {
		const items = await listMcqs();
		return Response.json({ items });
	} catch (error) {
		return mapMcqError(error);
	}
}

export async function POST(request: Request) {
	const input = parseCreateMcqBody(await readJsonBody(request));
	if (!input) {
		return jsonError(400, "Invalid multiple-choice question");
	}

	try {
		const mcq = await createMcq(input);
		return Response.json(mcq, { status: 201 });
	} catch (error) {
		return mapMcqError(error);
	}
}
