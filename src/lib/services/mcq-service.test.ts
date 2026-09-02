import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
	const bind = vi.fn();
	const all = vi.fn();
	const run = vi.fn();
	const prepare = vi.fn(() => {
		const statement = {
			bind: (...args: unknown[]) => {
				bind(...args);
				return statement;
			},
			all,
			run,
		};
		return statement;
	});
	return { mockDb: { prepare, bind, all, run } };
});

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(async () => ({
		env: { DB: mockDb },
	})),
}));

import {
	createMcq,
	deleteMcq,
	getMcqById,
	listMcqs,
	McqNotFoundError,
	McqValidationError,
	recordAttempt,
	updateMcq,
} from "@/lib/services/mcq-service";

const createdBy = "user-1";

const twoChoices = [
	{ body: "Carbon dioxide", isCorrect: true },
	{ body: "Oxygen", isCorrect: false },
];

const createInput = {
	name: "Photosynthesis",
	question: "Which gas do plants absorb?",
	createdBy,
	choices: twoChoices,
};

const mcqRow = {
	id: "mcq-1",
	name: "Photosynthesis",
	question: "Which gas do plants absorb?",
	created_by: createdBy,
	created_at: "2026-09-02 00:00:00",
	updated_at: "2026-09-02 00:00:00",
};

const choiceRows = [
	{
		id: "choice-1",
		mcq_id: "mcq-1",
		body: "Carbon dioxide",
		position: 0,
		is_correct: 1,
		created_at: "2026-09-02 00:00:00",
		updated_at: "2026-09-02 00:00:00",
	},
	{
		id: "choice-2",
		mcq_id: "mcq-1",
		body: "Oxygen",
		position: 1,
		is_correct: 0,
		created_at: "2026-09-02 00:00:00",
		updated_at: "2026-09-02 00:00:00",
	},
];

function expectNoDescriptionOrSnakeCorrect(value: object) {
	expect(value).not.toHaveProperty("description");
	expect(JSON.stringify(value)).not.toMatch(/is_correct/);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createMcq", () => {
	it("inserts name, question, created_by, and choices; returns camelCase booleans", async () => {
		mockDb.all
			.mockResolvedValueOnce({ results: [{ id: createdBy }] })
			.mockResolvedValueOnce({ results: [mcqRow] })
			.mockResolvedValueOnce({ results: [choiceRows[0]] })
			.mockResolvedValueOnce({ results: [choiceRows[1]] });

		const mcq = await createMcq(createInput);

		const sql = mockDb.prepare.mock.calls.map((call) => String(call[0])).join("\n");
		expect(sql).toMatch(/INSERT INTO mcqs/i);
		expect(sql).toMatch(/INSERT INTO mcq_choices/i);
		expect(mockDb.bind.mock.calls.some((args) => args.includes("Photosynthesis"))).toBe(true);
		expect(mockDb.bind.mock.calls.some((args) => args.includes("Which gas do plants absorb?"))).toBe(
			true,
		);
		expect(mockDb.bind.mock.calls.some((args) => args.includes(createdBy))).toBe(true);

		expect(mcq).toMatchObject({
			id: "mcq-1",
			name: "Photosynthesis",
			question: "Which gas do plants absorb?",
			createdBy,
		});
		expect(mcq.choices).toEqual([
			{ id: "choice-1", body: "Carbon dioxide", position: 0, isCorrect: true },
			{ id: "choice-2", body: "Oxygen", position: 1, isCorrect: false },
		]);
		expectNoDescriptionOrSnakeCorrect(mcq);
		for (const choice of mcq.choices) {
			expectNoDescriptionOrSnakeCorrect(choice);
		}
	});

	it("throws McqValidationError when createdBy is missing", async () => {
		await expect(createMcq({ ...createInput, createdBy: "   " })).rejects.toBeInstanceOf(
			McqValidationError,
		);
		expect(mockDb.prepare).not.toHaveBeenCalled();
	});

	it("throws McqValidationError when createdBy is not a known user", async () => {
		mockDb.all.mockResolvedValue({ results: [] });

		await expect(createMcq(createInput)).rejects.toBeInstanceOf(McqValidationError);
		const sql = String(mockDb.prepare.mock.calls[0]?.[0]);
		expect(sql).toMatch(/FROM users/i);
	});

	it("throws McqValidationError when there is one choice or seven choices", async () => {
		await expect(createMcq({ ...createInput, choices: [twoChoices[0]!] })).rejects.toBeInstanceOf(
			McqValidationError,
		);
		await expect(
			createMcq({
				...createInput,
				choices: Array.from({ length: 7 }, (_, i) => ({
					body: `Choice ${i}`,
					isCorrect: i === 0,
				})),
			}),
		).rejects.toBeInstanceOf(McqValidationError);
		expect(mockDb.prepare).not.toHaveBeenCalled();
	});

	it("throws McqValidationError when zero or more than one choice is correct", async () => {
		await expect(
			createMcq({
				...createInput,
				choices: [
					{ body: "A", isCorrect: false },
					{ body: "B", isCorrect: false },
				],
			}),
		).rejects.toBeInstanceOf(McqValidationError);
		await expect(
			createMcq({
				...createInput,
				choices: [
					{ body: "A", isCorrect: true },
					{ body: "B", isCorrect: true },
				],
			}),
		).rejects.toBeInstanceOf(McqValidationError);
		expect(mockDb.prepare).not.toHaveBeenCalled();
	});

	it("throws McqValidationError when name, question, or a choice body is blank", async () => {
		await expect(createMcq({ ...createInput, name: "  " })).rejects.toBeInstanceOf(McqValidationError);
		await expect(createMcq({ ...createInput, question: "" })).rejects.toBeInstanceOf(
			McqValidationError,
		);
		await expect(
			createMcq({
				...createInput,
				choices: [
					{ body: "   ", isCorrect: true },
					{ body: "Oxygen", isCorrect: false },
				],
			}),
		).rejects.toBeInstanceOf(McqValidationError);
		expect(mockDb.prepare).not.toHaveBeenCalled();
	});
});

describe("listMcqs", () => {
	it("returns items with name, question, and createdBy without nested choices", async () => {
		mockDb.all.mockResolvedValue({ results: [mcqRow] });

		const items = await listMcqs();

		const sql = String(mockDb.prepare.mock.calls[0]?.[0]);
		expect(sql).toMatch(/FROM mcqs/i);
		expect(sql).not.toMatch(/mcq_choices/i);
		expect(items).toEqual([
			{
				id: "mcq-1",
				name: "Photosynthesis",
				question: "Which gas do plants absorb?",
				createdBy,
				createdAt: mcqRow.created_at,
				updatedAt: mcqRow.updated_at,
			},
		]);
		expect(items[0]).not.toHaveProperty("choices");
		expectNoDescriptionOrSnakeCorrect(items[0]!);
	});
});

describe("getMcqById", () => {
	it("returns the MCQ and choices ordered by position", async () => {
		mockDb.all.mockResolvedValueOnce({ results: [mcqRow] }).mockResolvedValueOnce({
			results: [choiceRows[1], choiceRows[0]],
		});

		const mcq = await getMcqById("mcq-1");

		const choiceSql = String(mockDb.prepare.mock.calls[1]?.[0]);
		expect(choiceSql).toMatch(/FROM mcq_choices/i);
		expect(choiceSql).toMatch(/position/i);
		expect(mcq?.choices.map((c) => c.position)).toEqual([0, 1]);
		expect(mcq?.choices[0]?.isCorrect).toBe(true);
	});

	it("returns null when no MCQ matches", async () => {
		mockDb.all.mockResolvedValue({ results: [] });

		await expect(getMcqById("missing")).resolves.toBeNull();
	});
});

describe("updateMcq", () => {
	it("updates name, question, and updated_at but not created_by; syncs choices", async () => {
		const updatedRow = {
			...mcqRow,
			name: "Updated name",
			question: "Updated question?",
			updated_at: "2026-09-02 12:00:00",
		};
		const updatedChoices = [
			{ ...choiceRows[0], body: "CO2", position: 0, is_correct: 1 },
			{
				id: "choice-3",
				mcq_id: "mcq-1",
				body: "Nitrogen",
				position: 1,
				is_correct: 0,
				created_at: "2026-09-02 12:00:00",
				updated_at: "2026-09-02 12:00:00",
			},
		];

		mockDb.all
			.mockResolvedValueOnce({ results: [mcqRow] })
			.mockResolvedValueOnce({ results: choiceRows })
			.mockResolvedValueOnce({ results: [updatedRow] })
			.mockResolvedValueOnce({ results: [updatedChoices[0]] })
			.mockResolvedValueOnce({ results: [updatedChoices[1]] })
			.mockResolvedValueOnce({ results: [updatedRow] })
			.mockResolvedValueOnce({ results: updatedChoices });
		mockDb.run.mockResolvedValue({ success: true, meta: { changes: 1 } });

		const mcq = await updateMcq("mcq-1", {
			name: "Updated name",
			question: "Updated question?",
			choices: [
				{ id: "choice-1", body: "CO2", isCorrect: true },
				{ body: "Nitrogen", isCorrect: false },
			],
		});

		const sql = mockDb.prepare.mock.calls.map((call) => String(call[0])).join("\n");
		expect(sql).toMatch(/UPDATE mcqs/i);
		expect(sql).toMatch(/updated_at/i);
		expect(sql).not.toMatch(/SET[\s\S]*created_by\s*=/i);
		expect(sql).toMatch(/DELETE FROM mcq_choices/i);
		expect(mcq.name).toBe("Updated name");
		expect(mcq.question).toBe("Updated question?");
		expect(mcq.createdBy).toBe(createdBy);
		expect(mcq.choices.map((c) => c.body)).toEqual(["CO2", "Nitrogen"]);
	});
});

describe("deleteMcq", () => {
	it("removes the question so a later get returns null", async () => {
		mockDb.run.mockResolvedValue({ success: true, meta: { changes: 1 } });
		mockDb.all.mockResolvedValue({ results: [] });

		await deleteMcq("mcq-1");

		const sql = String(mockDb.prepare.mock.calls[0]?.[0]);
		expect(sql).toMatch(/DELETE FROM mcqs/i);
		expect(mockDb.bind).toHaveBeenCalledWith("mcq-1");
		await expect(getMcqById("mcq-1")).resolves.toBeNull();
	});
});

describe("recordAttempt", () => {
	it("inserts isCorrect from the selected choice and rejects a choice on another MCQ", async () => {
		mockDb.all
			.mockResolvedValueOnce({ results: [mcqRow] })
			.mockResolvedValueOnce({ results: choiceRows })
			.mockResolvedValueOnce({
				results: [
					{
						id: "attempt-1",
						mcq_id: "mcq-1",
						choice_id: "choice-1",
						is_correct: 1,
					},
				],
			});

		const attempt = await recordAttempt("mcq-1", "choice-1");

		const sql = mockDb.prepare.mock.calls.map((call) => String(call[0])).join("\n");
		expect(sql).toMatch(/INSERT INTO mcq_attempts/i);
		expect(attempt).toEqual({
			id: "attempt-1",
			mcqId: "mcq-1",
			choiceId: "choice-1",
			isCorrect: true,
		});

		vi.clearAllMocks();
		mockDb.all.mockResolvedValueOnce({ results: [mcqRow] }).mockResolvedValueOnce({
			results: choiceRows,
		});

		await expect(recordAttempt("mcq-1", "other-choice")).rejects.toBeInstanceOf(McqValidationError);
		const after = mockDb.prepare.mock.calls.map((call) => String(call[0])).join("\n");
		expect(after).not.toMatch(/INSERT INTO mcq_attempts/i);
	});

	it("throws McqNotFoundError when the MCQ does not exist", async () => {
		mockDb.all.mockResolvedValue({ results: [] });

		await expect(recordAttempt("missing", "choice-1")).rejects.toBeInstanceOf(McqNotFoundError);
	});
});
