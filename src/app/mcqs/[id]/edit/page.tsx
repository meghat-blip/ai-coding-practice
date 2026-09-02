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
		<main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-2xl font-medium">Edit question</h1>
				<Link href="/mcqs" className="text-sm underline-offset-4 hover:underline">
					Back
				</Link>
			</div>
			{error ? <p className="text-destructive">{error}</p> : null}
			{initialMcq ? <McqEditorForm mcqId={id} initialMcq={initialMcq} /> : null}
		</main>
	);
}
