import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sha256Hex } from "@/lib/password";
import { LoginForm } from "@/components/auth/login-form";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("fetch", vi.fn());
});

describe("LoginForm", () => {
	it("POSTs a hashed password to /api/auth/login and navigates to /mcqs on 200", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));
		render(<LoginForm />);

		await user.type(screen.getByLabelText("Username"), "ada");
		await user.type(screen.getByLabelText("Password"), "password1");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/auth/login");
		const body = JSON.parse(String(init.body)) as { username: string; passwordHash: string };
		expect(body.username).toBe("ada");
		expect(body.passwordHash).toBe(await sha256Hex("password1"));
		expect(push).toHaveBeenCalledWith("/mcqs");
	});

	it("shows Invalid username or password on 401 and does not navigate", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: "Invalid username or password" }), { status: 401 }),
		);
		render(<LoginForm />);

		await user.type(screen.getByLabelText("Username"), "ada");
		await user.type(screen.getByLabelText("Password"), "password1");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		expect(screen.getByRole("alert").textContent).toBe("Invalid username or password");
		expect(push).not.toHaveBeenCalled();
	});

	it("uses the shadcn login block without Google or password-reset links", () => {
		render(<LoginForm />);

		expect(screen.getByRole("button", { name: /^login$/i })).toBeTruthy();
		expect(screen.queryByRole("button", { name: /google/i })).toBeNull();
		expect(screen.queryByRole("link", { name: /forgot/i })).toBeNull();
		expect(screen.getByRole("link", { name: /sign up/i }).getAttribute("href")).toBe("/register");
	});
});
