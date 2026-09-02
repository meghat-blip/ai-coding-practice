import { getCloudflareContext } from "@opennextjs/cloudflare";

export class McqValidationError extends Error {
	constructor(message = "Invalid multiple-choice question") {
		super(message);
		this.name = "McqValidationError";
	}
}

export class McqNotFoundError extends Error {
	constructor(message = "Multiple-choice question not found") {
		super(message);
		this.name = "McqNotFoundError";
	}
}

export type McqChoice = {
	id: string;
	body: string;
	position: number;
	isCorrect: boolean;
};

export type Mcq = {
	id: string;
	name: string;
	question: string;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	choices: McqChoice[];
};

export type McqListItem = Omit<Mcq, "choices">;

export type ChoiceInput = {
	id?: string;
	body: string;
	isCorrect: boolean;
};

export type CreateMcqInput = {
	name: string;
	question: string;
	createdBy: string;
	choices: ChoiceInput[];
};

export type UpdateMcqInput = {
	name: string;
	question: string;
	choices: ChoiceInput[];
};

export type McqAttempt = {
	id: string;
	mcqId: string;
	choiceId: string;
	isCorrect: boolean;
};

type McqRow = {
	id: string;
	name: string;
	question: string;
	created_by: string;
	created_at: string;
	updated_at: string;
};

type ChoiceRow = {
	id: string;
	mcq_id: string;
	body: string;
	position: number;
	is_correct: number;
	created_at?: string;
	updated_at?: string;
};

type AttemptRow = {
	id: string;
	mcq_id: string;
	choice_id: string;
	is_correct: number;
};

const NAME_MAX = 255;
const MIN_CHOICES = 2;
const MAX_CHOICES = 6;

async function getDb() {
	const { env } = await getCloudflareContext({ async: true });
	return env.DB;
}

function trimRequired(value: string, field: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new McqValidationError(`${field} is required`);
	}
	return trimmed;
}

function validateChoices(choices: ChoiceInput[]): { body: string; isCorrect: boolean; id?: string }[] {
	if (choices.length < MIN_CHOICES || choices.length > MAX_CHOICES) {
		throw new McqValidationError("A question must have between 2 and 6 choices");
	}

	const normalized = choices.map((choice) => ({
		id: choice.id?.trim() || undefined,
		body: trimRequired(choice.body, "Choice text"),
		isCorrect: Boolean(choice.isCorrect),
	}));

	const correctCount = normalized.filter((choice) => choice.isCorrect).length;
	if (correctCount !== 1) {
		throw new McqValidationError("Exactly one choice must be marked correct");
	}

	return normalized;
}

function validateNameAndQuestion(name: string, question: string) {
	const trimmedName = trimRequired(name, "Name");
	if (trimmedName.length > NAME_MAX) {
		throw new McqValidationError("Name is too long");
	}
	const trimmedQuestion = trimRequired(question, "Question");
	return { name: trimmedName, question: trimmedQuestion };
}

function toChoice(row: ChoiceRow): McqChoice {
	return {
		id: row.id,
		body: row.body,
		position: row.position,
		isCorrect: Boolean(row.is_correct),
	};
}

function toListItem(row: McqRow): McqListItem {
	return {
		id: row.id,
		name: row.name,
		question: row.question,
		createdBy: row.created_by,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toMcq(row: McqRow, choiceRows: ChoiceRow[]): Mcq {
	const choices = [...choiceRows].sort((a, b) => a.position - b.position).map(toChoice);
	return { ...toListItem(row), choices };
}

async function loadChoices(mcqId: string): Promise<ChoiceRow[]> {
	const db = await getDb();
	const { results } = await db
		.prepare(
			`SELECT id, mcq_id, body, position, is_correct, created_at, updated_at
			 FROM mcq_choices
			 WHERE mcq_id = ?1
			 ORDER BY position ASC`,
		)
		.bind(mcqId)
		.all<ChoiceRow>();
	return results;
}

async function requireUserId(createdBy: string): Promise<void> {
	const db = await getDb();
	const { results } = await db.prepare("SELECT id FROM users WHERE id = ?1").bind(createdBy).all<{
		id: string;
	}>();
	if (!results[0]) {
		throw new McqValidationError("createdBy must refer to an existing user");
	}
}

async function insertChoice(
	mcqId: string,
	body: string,
	position: number,
	isCorrect: boolean,
): Promise<ChoiceRow> {
	const db = await getDb();
	const { results } = await db
		.prepare(
			`INSERT INTO mcq_choices (mcq_id, body, position, is_correct)
			 VALUES (?1, ?2, ?3, ?4)
			 RETURNING id, mcq_id, body, position, is_correct, created_at, updated_at`,
		)
		.bind(mcqId, body, position, isCorrect ? 1 : 0)
		.all<ChoiceRow>();
	const row = results[0];
	if (!row) {
		throw new Error("Failed to create choice");
	}
	return row;
}

export async function listMcqs(): Promise<McqListItem[]> {
	const db = await getDb();
	const { results } = await db
		.prepare(
			`SELECT id, name, question, created_by, created_at, updated_at
			 FROM mcqs
			 ORDER BY created_at DESC`,
		)
		.all<McqRow>();
	return results.map(toListItem);
}

export async function getMcqById(id: string): Promise<Mcq | null> {
	const db = await getDb();
	const { results } = await db
		.prepare(
			`SELECT id, name, question, created_by, created_at, updated_at
			 FROM mcqs
			 WHERE id = ?1`,
		)
		.bind(id)
		.all<McqRow>();
	const row = results[0];
	if (!row) {
		return null;
	}
	const choices = await loadChoices(id);
	return toMcq(row, choices);
}

export async function createMcq(input: CreateMcqInput): Promise<Mcq> {
	const createdBy = trimRequired(input.createdBy, "createdBy");
	const { name, question } = validateNameAndQuestion(input.name, input.question);
	const choices = validateChoices(input.choices);

	await requireUserId(createdBy);

	const db = await getDb();
	const { results } = await db
		.prepare(
			`INSERT INTO mcqs (name, question, created_by)
			 VALUES (?1, ?2, ?3)
			 RETURNING id, name, question, created_by, created_at, updated_at`,
		)
		.bind(name, question, createdBy)
		.all<McqRow>();
	const row = results[0];
	if (!row) {
		throw new Error("Failed to create multiple-choice question");
	}

	const choiceRows: ChoiceRow[] = [];
	for (const [position, choice] of choices.entries()) {
		choiceRows.push(await insertChoice(row.id, choice.body, position, choice.isCorrect));
	}

	return toMcq(row, choiceRows);
}

export async function updateMcq(id: string, input: UpdateMcqInput): Promise<Mcq> {
	const existing = await getMcqById(id);
	if (!existing) {
		throw new McqNotFoundError();
	}

	const { name, question } = validateNameAndQuestion(input.name, input.question);
	const choices = validateChoices(input.choices);

	const db = await getDb();
	const { results } = await db
		.prepare(
			`UPDATE mcqs
			 SET name = ?1, question = ?2, updated_at = CURRENT_TIMESTAMP
			 WHERE id = ?3
			 RETURNING id, name, question, created_by, created_at, updated_at`,
		)
		.bind(name, question, id)
		.all<McqRow>();
	if (!results[0]) {
		throw new McqNotFoundError();
	}

	const incomingIds = new Set(choices.map((choice) => choice.id).filter(Boolean) as string[]);
	for (const choice of existing.choices) {
		if (!incomingIds.has(choice.id)) {
			await db
				.prepare("DELETE FROM mcq_choices WHERE mcq_id = ?1 AND id = ?2")
				.bind(id, choice.id)
				.run();
		}
	}

	for (const [position, choice] of choices.entries()) {
		if (choice.id) {
			const { results: updated } = await db
				.prepare(
					`UPDATE mcq_choices
					 SET body = ?1, position = ?2, is_correct = ?3, updated_at = CURRENT_TIMESTAMP
					 WHERE id = ?4 AND mcq_id = ?5
					 RETURNING id, mcq_id, body, position, is_correct, created_at, updated_at`,
				)
				.bind(choice.body, position, choice.isCorrect ? 1 : 0, choice.id, id)
				.all<ChoiceRow>();
			if (!updated[0]) {
				throw new McqValidationError("Choice does not belong to this question");
			}
		} else {
			await insertChoice(id, choice.body, position, choice.isCorrect);
		}
	}

	const refreshed = await getMcqById(id);
	if (!refreshed) {
		throw new McqNotFoundError();
	}
	return refreshed;
}

export async function deleteMcq(id: string): Promise<void> {
	const db = await getDb();
	const result = await db.prepare("DELETE FROM mcqs WHERE id = ?1").bind(id).run();
	const changes = result.meta?.changes ?? 0;
	if (changes === 0) {
		throw new McqNotFoundError();
	}
}

export async function recordAttempt(mcqId: string, choiceId: string): Promise<McqAttempt> {
	const mcq = await getMcqById(mcqId);
	if (!mcq) {
		throw new McqNotFoundError();
	}

	const choice = mcq.choices.find((item) => item.id === choiceId);
	if (!choice) {
		throw new McqValidationError("choiceId does not belong to this question");
	}

	const db = await getDb();
	const { results } = await db
		.prepare(
			`INSERT INTO mcq_attempts (mcq_id, choice_id, is_correct)
			 VALUES (?1, ?2, ?3)
			 RETURNING id, mcq_id, choice_id, is_correct`,
		)
		.bind(mcqId, choiceId, choice.isCorrect ? 1 : 0)
		.all<AttemptRow>();
	const row = results[0];
	if (!row) {
		throw new Error("Failed to record attempt");
	}

	return {
		id: row.id,
		mcqId: row.mcq_id,
		choiceId: row.choice_id,
		isCorrect: Boolean(row.is_correct),
	};
}
