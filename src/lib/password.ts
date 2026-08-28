const SHA256_HEX = /^[a-f0-9]{64}$/;

export async function sha256Hex(plaintext: string): Promise<string> {
	const data = new TextEncoder().encode(plaintext);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isSha256Hex(value: string): boolean {
	return SHA256_HEX.test(value);
}
