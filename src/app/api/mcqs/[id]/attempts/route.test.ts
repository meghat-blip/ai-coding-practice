import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordAttempt, McqNotFoundError, McqValidationError } = vi.hoisted(() => {
	class McqNotFoundError extends Error {
		constructor(message = "Multiple-choice question not found") {
			super(message);
			this.name = "McqNotFoundError";
		}
	}
	class McqValidationError extends Error {
		constructor(message = "Invalid multiple-choice question") {
			super(message);
			this.name = "McqValidationError";
		}
	}
	return { recordAttempt: vi.fn(), McqNotFoundError, McqValidationError };
});

vi.mock("@/lib/services/mcq-service", () => ({
	McqNotFoundError,
	McqValidationError,
	recordAttempt,
}));

import { POST } from "@/app/api/mcqs/[id]/attempts/route";

function postJson(body: unknown, id = "mcq-1") {
	return POST(
		new Request(`http://localhost/api/mcqs/${id}/attempts`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
		{ params: Promise.resolve({ id }) },
	);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("POST /api/mcqs/:id/attempts", () => {
	it("returns 201 with isCorrect from the service", async () => {
		recordAttempt.mockResolvedValue({
			id: "attempt-1",
			mcqId: "mcq-1",
			choiceId: "choice-1",
			isCorrect: true,
		});

		const response = await postJson({ choiceId: "choice-1" });
		const json = await response.json();

		expect(response.status).toBe(201);
		expect(json).toEqual({
			id: "attempt-1",
			mcqId: "mcq-1",
			choiceId: "choice-1",
			isCorrect: true,
		});
		expect(recordAttempt).toHaveBeenCalledWith("mcq-1", "choice-1");
	});

	it("returns 400 when the body is missing or the choice is invalid", async () => {
		const missing = await postJson({});
		expect(missing.status).toBe(400);
		expect(recordAttempt).not.toHaveBeenCalled();

		recordAttempt.mockRejectedValueOnce(new McqValidationError("choiceId does not belong to this question"));
		const badChoice = await postJson({ choiceId: "other-choice" });
		expect(badChoice.status).toBe(400);
	});

	it("returns 404 when the MCQ does not exist", async () => {
		recordAttempt.mockRejectedValueOnce(new McqNotFoundError());

		const response = await postJson({ choiceId: "choice-1" });
		expect(response.status).toBe(404);
	});
});
