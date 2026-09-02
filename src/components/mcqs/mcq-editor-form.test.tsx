import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqEditorForm } from "@/components/mcqs/mcq-editor-form";

const { push, getStoredUserId } = vi.hoisted(() => ({
	push: vi.fn(),
	getStoredUserId: vi.fn(() => "user-1"),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

vi.mock("@/lib/client-user", () => ({
	getStoredUserId,
}));

beforeEach(() => {
	vi.clearAllMocks();
	getStoredUserId.mockReturnValue("user-1");
	vi.stubGlobal("fetch", vi.fn());
});

describe("McqEditorForm", () => {
	it("renders name, question, two choices, Save, and Cancel in create mode", () => {
		render(<McqEditorForm />);

		expect(screen.getByRole("heading", { name: /create question/i })).toBeTruthy();
		expect(screen.getByText(/short title shown in the question bank/i)).toBeTruthy();
		expect(screen.getByLabelText(/^name$/i)).toBeTruthy();
		expect(screen.getByLabelText(/^question$/i)).toBeTruthy();
		expect(screen.getByLabelText("Choice 1")).toBeTruthy();
		expect(screen.getByLabelText("Choice 2")).toBeTruthy();
		expect(screen.getByRole("button", { name: /^save$/i })).toBeTruthy();
		expect(screen.getByRole("button", { name: /^cancel$/i })).toBeTruthy();
	});

	it("adds choices up to six and cannot go below two", async () => {
		const user = userEvent.setup();
		render(<McqEditorForm />);

		const add = screen.getByRole("button", { name: /add choice/i });
		await user.click(add);
		await user.click(add);
		await user.click(add);
		await user.click(add);
		expect(screen.getByLabelText("Choice 6")).toBeTruthy();
		expect(screen.queryByLabelText("Choice 7")).toBeNull();
		expect(add).toHaveProperty("disabled", true);

		await user.click(screen.getByRole("button", { name: /remove choice 6/i }));
		expect(screen.queryByLabelText("Choice 6")).toBeNull();
		expect(screen.getByLabelText("Choice 5")).toBeTruthy();

		await user.click(screen.getByRole("button", { name: /remove choice 5/i }));
		await user.click(screen.getByRole("button", { name: /remove choice 4/i }));
		await user.click(screen.getByRole("button", { name: /remove choice 3/i }));
		expect(screen.getByLabelText("Choice 2")).toBeTruthy();
		expect(screen.queryByRole("button", { name: /remove choice 1/i })).toBeNull();
		expect(screen.queryByRole("button", { name: /remove choice 2/i })).toBeNull();
	});

	it("does not fetch when name, question, or a correct choice is missing", async () => {
		const user = userEvent.setup();
		render(<McqEditorForm />);

		await user.click(screen.getByRole("button", { name: /^save$/i }));
		expect(fetch).not.toHaveBeenCalled();

		await user.type(screen.getByLabelText(/^name$/i), "Title");
		await user.click(screen.getByRole("button", { name: /^save$/i }));
		expect(fetch).not.toHaveBeenCalled();

		await user.type(screen.getByLabelText(/^question$/i), "Stem?");
		await user.type(screen.getByLabelText("Choice 1"), "A");
		await user.type(screen.getByLabelText("Choice 2"), "B");
		await user.click(screen.getByRole("button", { name: /^save$/i }));
		expect(fetch).not.toHaveBeenCalled();
	});

	it("POSTs /api/mcqs with question and createdBy and navigates on 201", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: "mcq-1" }), { status: 201 }));
		render(<McqEditorForm />);

		await user.type(screen.getByLabelText(/^name$/i), "Photosynthesis");
		await user.type(screen.getByLabelText(/^question$/i), "Which gas do plants absorb?");
		await user.type(screen.getByLabelText("Choice 1"), "Carbon dioxide");
		await user.type(screen.getByLabelText("Choice 2"), "Oxygen");
		await user.click(screen.getByRole("radio", { name: /choice 1 is correct/i }));
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		expect(fetch).toHaveBeenCalledOnce();
		const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/mcqs");
		expect(init.method).toBe("POST");
		const body = JSON.parse(String(init.body)) as Record<string, unknown>;
		expect(body).toMatchObject({
			name: "Photosynthesis",
			question: "Which gas do plants absorb?",
			createdBy: "user-1",
			choices: [
				{ body: "Carbon dioxide", isCorrect: true },
				{ body: "Oxygen", isCorrect: false },
			],
		});
		expect(body).not.toHaveProperty("description");
		expect(push).toHaveBeenCalledWith("/mcqs");
	});

	it("does not fetch in create mode when there is no stored user id", async () => {
		getStoredUserId.mockReturnValue(null);
		const user = userEvent.setup();
		render(<McqEditorForm />);

		await user.type(screen.getByLabelText(/^name$/i), "Photosynthesis");
		await user.type(screen.getByLabelText(/^question$/i), "Which gas do plants absorb?");
		await user.type(screen.getByLabelText("Choice 1"), "Carbon dioxide");
		await user.type(screen.getByLabelText("Choice 2"), "Oxygen");
		await user.click(screen.getByRole("radio", { name: /choice 1 is correct/i }));
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		expect(fetch).not.toHaveBeenCalled();
		expect(screen.getByRole("alert").textContent).toMatch(/log in/i);
	});

	it("navigates to /mcqs on Cancel without fetch", async () => {
		const user = userEvent.setup();
		render(<McqEditorForm />);

		await user.click(screen.getByRole("button", { name: /^cancel$/i }));
		expect(push).toHaveBeenCalledWith("/mcqs");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("PUTs /api/mcqs/:id on save in edit mode without createdBy", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: "mcq-1" }), { status: 200 }));
		render(
			<McqEditorForm
				mcqId="mcq-1"
				initialMcq={{
					name: "Old",
					question: "Old stem?",
					choices: [
						{ id: "choice-1", body: "A", isCorrect: true },
						{ id: "choice-2", body: "B", isCorrect: false },
					],
				}}
			/>,
		);

		expect(screen.getByRole("heading", { name: /edit question/i })).toBeTruthy();

		await user.clear(screen.getByLabelText(/^name$/i));
		await user.type(screen.getByLabelText(/^name$/i), "New title");
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/mcqs/mcq-1");
		expect(init.method).toBe("PUT");
		const body = JSON.parse(String(init.body)) as Record<string, unknown>;
		expect(body).not.toHaveProperty("createdBy");
		expect(body.name).toBe("New title");
		expect(push).toHaveBeenCalledWith("/mcqs");
	});
});
