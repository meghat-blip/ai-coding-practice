import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sha256Hex } from "@/lib/password";
import { RegisterForm } from "@/components/auth/register-form";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("fetch", vi.fn());
});

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
	await user.type(screen.getByLabelText("First name"), "Ada");
	await user.type(screen.getByLabelText("Last name"), "Lovelace");
	await user.type(screen.getByLabelText("Username"), "ada@school.edu");
	await user.type(screen.getByLabelText("Email"), "ada@school.edu");
	await user.type(screen.getByLabelText("Password"), "password1");
	await user.type(screen.getByLabelText("Confirm Password"), "password1");
}

describe("RegisterForm", () => {
	it("renders first name, last name, username, email, and a password field", () => {
		render(<RegisterForm />);

		expect(screen.getByLabelText("First name")).toBeTruthy();
		expect(screen.getByLabelText("Last name")).toBeTruthy();
		expect(screen.getByLabelText("Username")).toBeTruthy();
		expect(screen.getByLabelText("Email")).toBeTruthy();
		expect(screen.getByLabelText("Password")).toHaveProperty("type", "password");
		expect(screen.getByLabelText("Confirm Password")).toHaveProperty("type", "password");
		expect(screen.getByText(/must be at least 8 characters/i)).toBeTruthy();
		expect(screen.queryByRole("button", { name: /google/i })).toBeNull();
		expect(screen.getByRole("button", { name: /create account/i })).toBeTruthy();
		expect(screen.getByRole("link", { name: /sign in/i }).getAttribute("href")).toBe("/login");
	});

	it("does not fetch when the password is shorter than 8 characters", async () => {
		const user = userEvent.setup();
		render(<RegisterForm />);

		await user.type(screen.getByLabelText("First name"), "Ada");
		await user.type(screen.getByLabelText("Last name"), "Lovelace");
		await user.type(screen.getByLabelText("Username"), "ada@school.edu");
		await user.type(screen.getByLabelText("Email"), "ada@school.edu");
		await user.type(screen.getByLabelText("Password"), "short");
		await user.type(screen.getByLabelText("Confirm Password"), "short");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(fetch).not.toHaveBeenCalled();
		expect(screen.getByRole("alert").textContent).toMatch(/at least 8 characters/i);
	});

	it("POSTs a SHA-256 passwordHash to /api/auth/register, not the typed password", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ id: "user-1" }), { status: 201 }),
		);
		render(<RegisterForm />);

		await fillValidForm(user);
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(fetch).toHaveBeenCalledOnce();
		const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/auth/register");
		const body = JSON.parse(String(init.body)) as { passwordHash: string; firstName: string };
		expect(body.firstName).toBe("Ada");
		expect(body.passwordHash).toMatch(/^[a-f0-9]{64}$/);
		expect(body.passwordHash).not.toBe("password1");
		expect(body.passwordHash).toBe(await sha256Hex("password1"));
		expect(body).not.toHaveProperty("password");
		expect(body).not.toHaveProperty("confirmPassword");
	});

	it("navigates to /mcqs after a 201 response", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 201 }));
		render(<RegisterForm />);

		await fillValidForm(user);
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(push).toHaveBeenCalledWith("/mcqs");
	});

	it("shows server errors for 409 and 400 and does not navigate", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: "Username or email already taken" }), { status: 409 }),
		);
		render(<RegisterForm />);

		await fillValidForm(user);
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(screen.getByRole("alert").textContent).toBe("Username or email already taken");
		expect(push).not.toHaveBeenCalled();

		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: "Invalid registration request" }), { status: 400 }),
		);
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(screen.getByRole("alert").textContent).toBe("Invalid registration request");
		expect(push).not.toHaveBeenCalled();
	});

	it("does not fetch when confirm password does not match", async () => {
		const user = userEvent.setup();
		render(<RegisterForm />);

		await user.type(screen.getByLabelText("First name"), "Ada");
		await user.type(screen.getByLabelText("Last name"), "Lovelace");
		await user.type(screen.getByLabelText("Username"), "ada@school.edu");
		await user.type(screen.getByLabelText("Email"), "ada@school.edu");
		await user.type(screen.getByLabelText("Password"), "password1");
		await user.type(screen.getByLabelText("Confirm Password"), "password2");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(fetch).not.toHaveBeenCalled();
		expect(screen.getByRole("alert").textContent).toMatch(/do not match/i);
	});
});
