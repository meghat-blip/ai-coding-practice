import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqRowActions } from "@/components/mcqs/mcq-row-actions";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("fetch", vi.fn());
});

const mcq = { id: "mcq-1", name: "Photosynthesis" };

describe("McqRowActions", () => {
	it("has an accessible Actions button and a menu with Edit, Preview, and Delete", async () => {
		const user = userEvent.setup();
		render(<McqRowActions mcq={mcq} onDeleted={() => undefined} />);

		const trigger = screen.getByRole("button", { name: /actions for photosynthesis/i });
		await user.click(trigger);

		expect(await screen.findByRole("menuitem", { name: /^edit$/i })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /^preview$/i })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /^delete$/i })).toBeTruthy();
	});

	it("navigates to edit and preview routes", async () => {
		const user = userEvent.setup();
		render(<McqRowActions mcq={mcq} onDeleted={() => undefined} />);

		await user.click(screen.getByRole("button", { name: /actions for photosynthesis/i }));
		await user.click(await screen.findByRole("menuitem", { name: /^edit$/i }));
		expect(push).toHaveBeenCalledWith("/mcqs/mcq-1/edit");

		await user.click(screen.getByRole("button", { name: /actions for photosynthesis/i }));
		await user.click(await screen.findByRole("menuitem", { name: /^preview$/i }));
		expect(push).toHaveBeenCalledWith("/mcqs/mcq-1/preview");
	});

	it("confirms delete then DELETEs the MCQ and notifies the parent", async () => {
		const user = userEvent.setup();
		const onDeleted = vi.fn();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
		render(<McqRowActions mcq={mcq} onDeleted={onDeleted} />);

		await user.click(screen.getByRole("button", { name: /actions for photosynthesis/i }));
		await user.click(await screen.findByRole("menuitem", { name: /^delete$/i }));
		await user.click(await screen.findByRole("button", { name: /delete question/i }));

		expect(fetch).toHaveBeenCalledWith("/api/mcqs/mcq-1", { method: "DELETE" });
		expect(onDeleted).toHaveBeenCalledOnce();
	});
});
