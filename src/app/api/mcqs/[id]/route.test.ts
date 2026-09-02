import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteMcq, getMcqById, updateMcq, McqNotFoundError, McqValidationError } = vi.hoisted(() => {
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
	return {
		deleteMcq: vi.fn(),
		getMcqById: vi.fn(),
		updateMcq: vi.fn(),
		McqNotFoundError,
		McqValidationError,
	};
});

vi.mock("@/lib/services/mcq-service", () => ({
	McqNotFoundError,
	McqValidationError,
	deleteMcq,
	getMcqById,
	updateMcq,
}));

import { DELETE, GET, PUT } from "@/app/api/mcqs/[id]/route";

const mcq = {
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

const context = { params: Promise.resolve({ id: "mcq-1" }) };

function putJson(body: unknown, id = "mcq-1") {
	return PUT(
		new Request(`http://localhost/api/mcqs/${id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
		{ params: Promise.resolve({ id }) },
	);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /api/mcqs/:id", () => {
	it("returns 200 for a known id and 404 when missing", async () => {
		getMcqById.mockResolvedValueOnce(mcq);
		const found = await GET(new Request("http://localhost/api/mcqs/mcq-1"), context);
		expect(found.status).toBe(200);
		await expect(found.json()).resolves.toEqual(mcq);
		expect(getMcqById).toHaveBeenCalledWith("mcq-1");

		getMcqById.mockResolvedValueOnce(null);
		const missing = await GET(new Request("http://localhost/api/mcqs/missing"), {
			params: Promise.resolve({ id: "missing" }),
		});
		expect(missing.status).toBe(404);
	});
});

describe("PUT /api/mcqs/:id", () => {
	const validBody = {
		name: "Updated",
		question: "New stem?",
		createdBy: "should-be-ignored",
		choices: [
			{ id: "choice-1", body: "Carbon dioxide", isCorrect: true },
			{ body: "Nitrogen", isCorrect: false },
		],
	};

	it("returns 200 and does not pass a new author to the service", async () => {
		updateMcq.mockResolvedValue({ ...mcq, name: "Updated" });

		const response = await putJson(validBody);
		expect(response.status).toBe(200);
		expect(updateMcq).toHaveBeenCalledWith("mcq-1", {
			name: "Updated",
			question: "New stem?",
			choices: [
				{ id: "choice-1", body: "Carbon dioxide", isCorrect: true },
				{ body: "Nitrogen", isCorrect: false },
			],
		});
		expect(updateMcq.mock.calls[0]?.[1]).not.toHaveProperty("createdBy");
	});

	it("returns 400 for invalid bodies and 404 when the MCQ is missing", async () => {
		const invalid = await putJson({ ...validBody, name: "" });
		expect(invalid.status).toBe(400);
		expect(updateMcq).not.toHaveBeenCalled();

		updateMcq.mockRejectedValueOnce(new McqNotFoundError());
		const missing = await putJson(validBody);
		expect(missing.status).toBe(404);
	});
});

describe("DELETE /api/mcqs/:id", () => {
	it("returns 200 { ok: true } for a known id and 404 when missing", async () => {
		deleteMcq.mockResolvedValueOnce(undefined);
		const deleted = await DELETE(new Request("http://localhost/api/mcqs/mcq-1"), context);
		expect(deleted.status).toBe(200);
		await expect(deleted.json()).resolves.toEqual({ ok: true });
		expect(deleteMcq).toHaveBeenCalledWith("mcq-1");

		deleteMcq.mockRejectedValueOnce(new McqNotFoundError());
		const missing = await DELETE(new Request("http://localhost/api/mcqs/missing"), {
			params: Promise.resolve({ id: "missing" }),
		});
		expect(missing.status).toBe(404);
	});
});
