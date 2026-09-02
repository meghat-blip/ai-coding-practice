"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clearStoredUserId } from "@/lib/client-user";

export function LogoutButton() {
	const router = useRouter();

	async function onLogout() {
		try {
			await fetch("/api/auth/logout", { method: "POST" });
		} finally {
			clearStoredUserId();
			router.push("/login");
		}
	}

	return (
		<Button type="button" variant="outline" onClick={onLogout}>
			Log out
		</Button>
	);
}
