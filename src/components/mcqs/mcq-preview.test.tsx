import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqPreview } from "@/components/mcqs/mcq-preview";

const mcq = {
	id: "mcq-1",
	name: "Photosynthesis",
	question: "Which gas do plants absorb?",
	choices: [
		{ id: "choice-1", body: "Carbon dioxide", isCorrect: true },
		{ id: "choice-2", body: "Oxygen", isCorrect: false },
	],
};

beforeEach(() => {
	vi.stubGlobal("fetch", vi.fn());
});

describe("McqPreview", () => {
	it("renders the question stem and choices without exposing the key before submit", () => {
		render(<McqPreview mcq={mcq} />);

		expect(screen.getByText("Which gas do plants absorb?")).toBeTruthy();
		expect(screen.getByText(/select one answer/i)).toBeTruthy();
		expect(screen.getByRole("radio", { name: /carbon dioxide/i })).toBeTruthy();
		expect(screen.getByRole("radio", { name: /oxygen/i })).toBeTruthy();
		expect(screen.queryByText(/^correct$/i)).toBeNull();
		expect(screen.queryByText(/^incorrect$/i)).toBeNull();
	});

	it("POSTs an attempt and shows whether the answer was correct", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ id: "attempt-1", mcqId: "mcq-1", choiceId: "choice-2", isCorrect: false }), {
				status: 201,
			}),
		);
		render(<McqPreview mcq={mcq} />);

		await user.click(screen.getByRole("radio", { name: /oxygen/i }));
		await user.click(screen.getByRole("button", { name: /check answer/i }));

		expect(fetch).toHaveBeenCalledWith("/api/mcqs/mcq-1/attempts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ choiceId: "choice-2" }),
		});
		expect(await screen.findByText(/^incorrect$/i)).toBeTruthy();
		expect(screen.getByText(/^incorrect$/i).getAttribute("data-slot")).toBe("badge");
	});
});
