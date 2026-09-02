import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function loadMigration0002(): string {
	const dir = join(process.cwd(), "migrations");
	const files = readdirSync(dir).filter((name) => name.startsWith("0002_") && name.endsWith(".sql"));
	expect(files, "expected a migrations/0002_*.sql file").toHaveLength(1);
	return readFileSync(join(dir, files[0]!), "utf8");
}

function tableBlock(sql: string, tableName: string): string {
	const match = sql.match(new RegExp(`CREATE TABLE ${tableName}\\s*\\(([\\s\\S]*?)\\);`, "i"));
	expect(match, `expected CREATE TABLE ${tableName}`).toBeTruthy();
	return match![1] ?? "";
}

describe("MCQ schema contract (migration 0002)", () => {
	it("creates mcqs with id, name, question, created_by, and timestamps (no description)", () => {
		const sql = loadMigration0002();
		const mcqs = tableBlock(sql, "mcqs");

		expect(mcqs).toMatch(/\bid\b/i);
		expect(mcqs).toMatch(/\bname\s+TEXT\s+NOT NULL/i);
		expect(mcqs).toMatch(/\bquestion\s+TEXT\s+NOT NULL/i);
		expect(mcqs).toMatch(/\bcreated_by\s+TEXT\s+NOT NULL/i);
		expect(mcqs).toMatch(/\bcreated_at\s+DATETIME/i);
		expect(mcqs).toMatch(/\bupdated_at\s+DATETIME/i);
		expect(mcqs).not.toMatch(/\bdescription\b/i);
		expect(mcqs).toMatch(/FOREIGN KEY\s*\(\s*created_by\s*\)\s*REFERENCES\s+users\s*\(\s*id\s*\)/i);
		expect(mcqs).not.toMatch(/REFERENCES\s+users\s*\(\s*id\s*\)\s*ON DELETE CASCADE/i);
		expect(sql).toMatch(/CREATE INDEX\s+idx_mcqs_created_by\s+ON\s+mcqs\s*\(\s*created_by\s*\)/i);
	});

	it("creates mcq_choices with FK to mcqs ON DELETE CASCADE", () => {
		const sql = loadMigration0002();
		const choices = tableBlock(sql, "mcq_choices");

		expect(choices).toMatch(/\bmcq_id\s+TEXT\s+NOT NULL/i);
		expect(choices).toMatch(/\bbody\s+TEXT\s+NOT NULL/i);
		expect(choices).toMatch(/\bposition\s+INTEGER\s+NOT NULL/i);
		expect(choices).toMatch(/\bis_correct\s+INTEGER\s+NOT NULL/i);
		expect(choices).toMatch(/\bcreated_at\s+DATETIME/i);
		expect(choices).toMatch(/\bupdated_at\s+DATETIME/i);
		expect(choices).toMatch(
			/FOREIGN KEY\s*\(\s*mcq_id\s*\)\s*REFERENCES\s+mcqs\s*\(\s*id\s*\)\s*ON DELETE CASCADE/i,
		);
		expect(sql).toMatch(/CREATE INDEX\s+idx_mcq_choices_mcq_id\s+ON\s+mcq_choices\s*\(\s*mcq_id\s*\)/i);
	});

	it("creates mcq_attempts with FKs to mcqs and mcq_choices ON DELETE CASCADE", () => {
		const sql = loadMigration0002();
		const attempts = tableBlock(sql, "mcq_attempts");

		expect(attempts).toMatch(/\bmcq_id\s+TEXT\s+NOT NULL/i);
		expect(attempts).toMatch(/\bchoice_id\s+TEXT\s+NOT NULL/i);
		expect(attempts).toMatch(/\bis_correct\s+INTEGER\s+NOT NULL/i);
		expect(attempts).toMatch(/\bcreated_at\s+DATETIME/i);
		expect(attempts).toMatch(
			/FOREIGN KEY\s*\(\s*mcq_id\s*\)\s*REFERENCES\s+mcqs\s*\(\s*id\s*\)\s*ON DELETE CASCADE/i,
		);
		expect(attempts).toMatch(
			/FOREIGN KEY\s*\(\s*choice_id\s*\)\s*REFERENCES\s+mcq_choices\s*\(\s*id\s*\)\s*ON DELETE CASCADE/i,
		);
		expect(sql).toMatch(/CREATE INDEX\s+idx_mcq_attempts_mcq_id\s+ON\s+mcq_attempts\s*\(\s*mcq_id\s*\)/i);
		expect(sql).toMatch(/CREATE INDEX\s+idx_mcq_attempts_choice_id\s+ON\s+mcq_attempts\s*\(\s*choice_id\s*\)/i);
	});
});
