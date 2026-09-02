import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMcq, listMcqs, McqValidationError } = vi.hoisted(() => {
	class McqValidationError extends Error {
		constructor(message = "Invalid multiple-choice question") {
			super(message);
			this.name = "McqValidationError";
		}
	}
	return { createMcq: vi.fn(), listMcqs: vi.fn(), McqValidationError };
});

vi.mock("@/lib/services/mcq-service", () => ({
	McqValidationError,
	createMcq,
	listMcqs,
}));

import { GET, POST } from "@/app/api/mcqs/route";

const createdMcq = {
	id: "mcq-1",
	name: "Photosynthesis",
	question: "Which gas do plants absorb?",
	createdBy: "user-1",
	createdAt: "2026-09-02 00:00:00",
	updatedAt: "2026-09-02 00:00:00",
	choices: [
		{ id: "choice-1", body: "Carbon dioxide", position: 0, isCorrect: true },
		{ id: "choice-2", body: "Oxygen", position: 1, isCorrect: false },
	],
};

const validBody = {
	name: "  Photosynthesis  ",
	question: "  Which gas do plants absorb?  ",
	createdBy: "  user-1  ",
	choices: [
		{ body: "  Carbon dioxide  ", isCorrect: true },
		{ body: "Oxygen", isCorrect: false },
	],
};

function postJson(body: unknown) {
	return POST(
		new Request("http://localhost/api/mcqs", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /api/mcqs", () => {
	it("returns 200 { items } from listMcqs", async () => {
		const item = {
			id: "mcq-1",
			name: "Photosynthesis",
			question: "Which gas do plants absorb?",
			createdBy: "user-1",
			createdAt: "2026-09-02 00:00:00",
			updatedAt: "2026-09-02 00:00:00",
		};
		listMcqs.mockResolvedValue([item]);

		const response = await GET();
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({ items: [item] });
		expect(listMcqs).toHaveBeenCalledOnce();
	});
});

describe("POST /api/mcqs", () => {
	it("returns 201 and calls createMcq with trimmed fields and choices", async () => {
		createMcq.mockResolvedValue(createdMcq);

		const response = await postJson(validBody);
		const json = await response.json();

		expect(response.status).toBe(201);
		expect(json).toEqual(createdMcq);
		expect(createMcq).toHaveBeenCalledWith({
			name: "Photosynthesis",
			question: "Which gas do plants absorb?",
			createdBy: "user-1",
			choices: [
				{ body: "Carbon dioxide", isCorrect: true },
				{ body: "Oxygen", isCorrect: false },
			],
		});
	});

	it("returns 400 and does not call createMcq when createdBy or question is missing", async () => {
		const noAuthor = await postJson({ ...validBody, createdBy: "" });
		expect(noAuthor.status).toBe(400);
		expect(createMcq).not.toHaveBeenCalled();

		const noQuestion = await postJson({ ...validBody, question: "   " });
		expect(noQuestion.status).toBe(400);
		expect(createMcq).not.toHaveBeenCalled();
	});

	it("returns 400 and does not call createMcq when choices are invalid", async () => {
		const tooFew = await postJson({
			...validBody,
			choices: [{ body: "Only one", isCorrect: true }],
		});
		expect(tooFew.status).toBe(400);
		expect(createMcq).not.toHaveBeenCalled();

		const twoCorrect = await postJson({
			...validBody,
			choices: [
				{ body: "A", isCorrect: true },
				{ body: "B", isCorrect: true },
			],
		});
		expect(twoCorrect.status).toBe(400);
		expect(createMcq).not.toHaveBeenCalled();
	});
});
