const STORAGE_KEY = "quizmaker.userId";

export function getStoredUserId(): string | null {
	if (typeof sessionStorage === "undefined") {
		return null;
	}
	const value = sessionStorage.getItem(STORAGE_KEY);
	return value?.trim() || null;
}

export function setStoredUserId(id: string): void {
	sessionStorage.setItem(STORAGE_KEY, id);
}

export function clearStoredUserId(): void {
	sessionStorage.removeItem(STORAGE_KEY);
}

export function storeUserIdFromUnknown(data: unknown): void {
	if (typeof data !== "object" || data === null || !("id" in data)) {
		return;
	}
	const id = data.id;
	if (typeof id === "string" && id.trim()) {
		setStoredUserId(id.trim());
	}
}
