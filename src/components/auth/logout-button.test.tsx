import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogoutButton } from "@/components/auth/logout-button";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("fetch", vi.fn());
});

describe("LogoutButton", () => {
	it("POSTs /api/auth/logout then navigates to /login", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
		render(<LogoutButton />);

		await user.click(screen.getByRole("button", { name: /log out/i }));

		expect(fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
		expect(push).toHaveBeenCalledWith("/login");
	});
});
