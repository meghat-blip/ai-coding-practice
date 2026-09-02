"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { McqPreview } from "@/components/mcqs/mcq-preview";

type LoadedMcq = {
	id: string;
	name: string;
	question: string;
	choices: { id: string; body: string }[];
};

export default function PreviewMcqPage() {
	const { id } = useParams<{ id: string }>();
	const [mcq, setMcq] = useState<LoadedMcq | null>(null);
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
					"id" in data &&
					"question" in data &&
					"choices" in data &&
					Array.isArray((data as { choices: unknown }).choices)
				) {
					const loaded = data as LoadedMcq;
					setMcq({
						id: loaded.id,
						name: loaded.name,
						question: loaded.question,
						choices: loaded.choices.map((choice) => ({ id: choice.id, body: choice.body })),
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
				{mcq ? <McqPreview mcq={mcq} /> : null}
			</div>
		</div>
	);
}
