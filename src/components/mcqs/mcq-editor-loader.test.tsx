import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqEditorLoader } from "@/components/mcqs/mcq-editor-loader";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

const loaded = {
	id: "mcq-1",
	name: "Old",
	question: "Old stem?",
	choices: [
		{ id: "choice-1", body: "A", isCorrect: true },
		{ id: "choice-2", body: "B", isCorrect: false },
	],
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("fetch", vi.fn());
});

describe("McqEditorLoader", () => {
	it("shows loading copy until GET /api/mcqs/:id resolves, then Edit question", async () => {
		let resolveFetch!: (value: Response) => void;
		vi.mocked(fetch).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveFetch = resolve;
				}),
		);
		render(<McqEditorLoader mcqId="mcq-1" />);

		expect(screen.getByText(/loading question/i)).toBeTruthy();
		resolveFetch(new Response(JSON.stringify(loaded), { status: 200 }));
		expect(await screen.findByRole("heading", { name: /edit question/i })).toBeTruthy();
		expect(screen.queryByText(/loading question/i)).toBeNull();
		expect(fetch).toHaveBeenCalledWith("/api/mcqs/mcq-1");
	});

	it("shows Question not found on 404 and does not render the editor", async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "Missing" }), { status: 404 }));
		render(<McqEditorLoader mcqId="missing" />);

		expect(await screen.findByText(/question not found/i)).toBeTruthy();
		expect(screen.queryByRole("heading", { name: /edit question/i })).toBeNull();
		expect(screen.queryByLabelText(/^name$/i)).toBeNull();
	});

	it("shows Could not load this question on 500 even if the body looks like an MCQ", async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(loaded), { status: 500 }));
		render(<McqEditorLoader mcqId="mcq-1" />);

		expect(await screen.findByText(/could not load this question/i)).toBeTruthy();
		expect(screen.queryByRole("heading", { name: /edit question/i })).toBeNull();
	});
});
