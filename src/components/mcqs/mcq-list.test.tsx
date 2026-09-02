import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqList } from "@/components/mcqs/mcq-list";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("fetch", vi.fn());
});

describe("McqList", () => {
	it("renders a table with Name, Question, and Actions, and Create goes to /mcqs/new", async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
		render(<McqList />);

		expect(screen.getByRole("columnheader", { name: /name/i })).toBeTruthy();
		expect(screen.getByRole("columnheader", { name: /question/i })).toBeTruthy();
		expect(screen.getByRole("columnheader", { name: /actions/i })).toBeTruthy();

		expect(screen.getByRole("link", { name: /create question/i }).getAttribute("href")).toBe("/mcqs/new");
		expect(await screen.findByText(/no questions yet/i)).toBeTruthy();
	});

	it("shows name and question after a successful GET /api/mcqs", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(
				JSON.stringify({
					items: [
						{
							id: "mcq-1",
							name: "Photosynthesis",
							question: "Which gas do plants absorb?",
							createdBy: "user-1",
							createdAt: "2026-09-02",
							updatedAt: "2026-09-02",
						},
					],
				}),
				{ status: 200 },
			),
		);
		render(<McqList />);

		expect(await screen.findByText("Photosynthesis")).toBeTruthy();
		expect(screen.getByText("Which gas do plants absorb?")).toBeTruthy();
		expect(fetch).toHaveBeenCalledWith("/api/mcqs");
	});

	it("shows an empty state when items is empty", async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
		render(<McqList />);

		expect(await screen.findByText(/no questions yet/i)).toBeTruthy();
	});
});
