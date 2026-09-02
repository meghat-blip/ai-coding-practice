import { recordAttempt } from "@/lib/services/mcq-service";
import {
	jsonError,
	mapMcqError,
	parseAttemptBody,
	readJsonBody,
	readMcqId,
	type McqIdContext,
} from "@/lib/mcq-http";

export async function POST(request: Request, context: McqIdContext) {
	const id = await readMcqId(context);
	if (!id) {
		return jsonError(400, "Invalid multiple-choice question id");
	}

	const input = parseAttemptBody(await readJsonBody(request));
	if (!input) {
		return jsonError(400, "Invalid attempt");
	}

	try {
		const attempt = await recordAttempt(id, input.choiceId);
		return Response.json(attempt, { status: 201 });
	} catch (error) {
		return mapMcqError(error);
	}
}
