import { deleteMcq, getMcqById, updateMcq } from "@/lib/services/mcq-service";
import {
	jsonError,
	mapMcqError,
	parseUpdateMcqBody,
	readJsonBody,
	readMcqId,
	type McqIdContext,
} from "@/lib/mcq-http";

export async function GET(_request: Request, context: McqIdContext) {
	const id = await readMcqId(context);
	if (!id) {
		return jsonError(400, "Invalid multiple-choice question id");
	}

	try {
		const mcq = await getMcqById(id);
		if (!mcq) {
			return jsonError(404, "Multiple-choice question not found");
		}
		return Response.json(mcq);
	} catch (error) {
		return mapMcqError(error);
	}
}

export async function PUT(request: Request, context: McqIdContext) {
	const id = await readMcqId(context);
	if (!id) {
		return jsonError(400, "Invalid multiple-choice question id");
	}

	const input = parseUpdateMcqBody(await readJsonBody(request));
	if (!input) {
		return jsonError(400, "Invalid multiple-choice question");
	}

	try {
		const mcq = await updateMcq(id, input);
		return Response.json(mcq);
	} catch (error) {
		return mapMcqError(error);
	}
}

export async function DELETE(_request: Request, context: McqIdContext) {
	const id = await readMcqId(context);
	if (!id) {
		return jsonError(400, "Invalid multiple-choice question id");
	}

	try {
		await deleteMcq(id);
		return Response.json({ ok: true });
	} catch (error) {
		return mapMcqError(error);
	}
}
