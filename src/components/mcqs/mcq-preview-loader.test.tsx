import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqPreviewLoader } from "@/components/mcqs/mcq-preview-loader";

const loaded = {
	id: "mcq-1",
	name: "Photosynthesis",
	question: "Which gas do plants absorb?",
	choices: [
		{ id: "choice-1", body: "Carbon dioxide", isCorrect: true },
		{ id: "choice-2", body: "Oxygen", isCorrect: false },
	],
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("fetch", vi.fn());
});

describe("McqPreviewLoader", () => {
	it("shows loading copy until GET resolves, then the question stem", async () => {
		let resolveFetch!: (value: Response) => void;
		vi.mocked(fetch).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveFetch = resolve;
				}),
		);
		render(<McqPreviewLoader mcqId="mcq-1" />);

		expect(screen.getByText(/loading question/i)).toBeTruthy();
		resolveFetch(new Response(JSON.stringify(loaded), { status: 200 }));
		expect(await screen.findByText("Which gas do plants absorb?")).toBeTruthy();
		expect(screen.queryByText(/loading question/i)).toBeNull();
		expect(fetch).toHaveBeenCalledWith("/api/mcqs/mcq-1");
	});

	it("shows Question not found on 404 and does not render Check answer", async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "Missing" }), { status: 404 }));
		render(<McqPreviewLoader mcqId="missing" />);

		expect(await screen.findByText(/question not found/i)).toBeTruthy();
		expect(screen.queryByRole("button", { name: /check answer/i })).toBeNull();
	});

	it("shows Could not load this question on 500 even if the body looks like an MCQ", async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(loaded), { status: 500 }));
		render(<McqPreviewLoader mcqId="mcq-1" />);

		expect(await screen.findByText(/could not load this question/i)).toBeTruthy();
		expect(screen.queryByRole("button", { name: /check answer/i })).toBeNull();
	});
});
