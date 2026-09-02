"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { McqEditorForm, type EditorMcq } from "@/components/mcqs/mcq-editor-form";

export default function EditMcqPage() {
	const { id } = useParams<{ id: string }>();
	const [initialMcq, setInitialMcq] = useState<EditorMcq | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function load() {
			try {
				const response = await fetch(`/api/mcqs/${id}`);
				if (response.status === 404) {
					setError("Question not found");
					return;
				}
				const data: unknown = await response.json();
				if (
					typeof data === "object" &&
					data !== null &&
					"name" in data &&
					"question" in data &&
					"choices" in data &&
					Array.isArray((data as { choices: unknown }).choices)
				) {
					const mcq = data as EditorMcq & { name: string; question: string };
					setInitialMcq({
						name: mcq.name,
						question: mcq.question,
						choices: mcq.choices.map((choice) => ({
							id: choice.id,
							body: choice.body,
							isCorrect: choice.isCorrect,
						})),
					});
					return;
				}
				setError("Could not load this question");
			} catch {
				setError("Could not load this question");
			}
		}
		void load();
	}, [id]);

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-xl flex-col gap-4">
				<Link href="/mcqs" className="text-sm underline-offset-4 hover:underline">
					Back to question bank
				</Link>
				{error ? <p className="text-destructive">{error}</p> : null}
				{initialMcq ? <McqEditorForm mcqId={id} initialMcq={initialMcq} /> : null}
			</div>
		</div>
	);
}
