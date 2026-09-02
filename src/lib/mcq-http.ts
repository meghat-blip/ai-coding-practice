import { jsonError, readJsonBody } from "@/lib/auth-http";
import type { ChoiceInput, CreateMcqInput, UpdateMcqInput } from "@/lib/services/mcq-service";
import { McqNotFoundError, McqValidationError } from "@/lib/services/mcq-service";

const NAME_MAX = 255;
const QUESTION_MAX = 8000;
const MIN_CHOICES = 2;
const MAX_CHOICES = 6;

export type McqIdContext = {
	params: Promise<{ id: string }>;
};

export async function readMcqId(context: McqIdContext): Promise<string | null> {
	const { id } = await context.params;
	const trimmed = id.trim();
	return trimmed || null;
}

function readLimitedString(
	body: Record<string, unknown>,
	key: string,
	maxLength: number,
): string | null {
	const value = body[key];
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	if (!trimmed || trimmed.length > maxLength) {
		return null;
	}
	return trimmed;
}

function parseChoices(value: unknown): ChoiceInput[] | null {
	if (!Array.isArray(value) || value.length < MIN_CHOICES || value.length > MAX_CHOICES) {
		return null;
	}

	const choices: ChoiceInput[] = [];
	for (const item of value) {
		if (typeof item !== "object" || item === null || Array.isArray(item)) {
			return null;
		}
		const record = item as Record<string, unknown>;
		if (typeof record.body !== "string" || typeof record.isCorrect !== "boolean") {
			return null;
		}
		const body = record.body.trim();
		if (!body) {
			return null;
		}
		const choice: ChoiceInput = { body, isCorrect: record.isCorrect };
		if (typeof record.id === "string" && record.id.trim()) {
			choice.id = record.id.trim();
		}
		choices.push(choice);
	}

	if (choices.filter((choice) => choice.isCorrect).length !== 1) {
		return null;
	}

	return choices;
}

export function parseCreateMcqBody(body: Record<string, unknown> | null): CreateMcqInput | null {
	if (!body) {
		return null;
	}
	const name = readLimitedString(body, "name", NAME_MAX);
	const question = readLimitedString(body, "question", QUESTION_MAX);
	const createdBy = readLimitedString(body, "createdBy", NAME_MAX);
	const choices = parseChoices(body.choices);
	if (!name || !question || !createdBy || !choices) {
		return null;
	}
	return { name, question, createdBy, choices };
}

export function parseUpdateMcqBody(body: Record<string, unknown> | null): UpdateMcqInput | null {
	if (!body) {
		return null;
	}
	const name = readLimitedString(body, "name", NAME_MAX);
	const question = readLimitedString(body, "question", QUESTION_MAX);
	const choices = parseChoices(body.choices);
	if (!name || !question || !choices) {
		return null;
	}
	return { name, question, choices };
}

export function parseAttemptBody(body: Record<string, unknown> | null): { choiceId: string } | null {
	if (!body) {
		return null;
	}
	const choiceId = readLimitedString(body, "choiceId", NAME_MAX);
	if (!choiceId) {
		return null;
	}
	return { choiceId };
}

export function mapMcqError(error: unknown) {
	if (error instanceof McqValidationError) {
		return jsonError(400, error.message);
	}
	if (error instanceof McqNotFoundError) {
		return jsonError(404, error.message);
	}
	return jsonError(500, "Server error");
}

export { jsonError, readJsonBody };
