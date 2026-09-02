"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type PreviewChoice = {
	id: string;
	body: string;
};

type McqPreviewProps = {
	mcq: {
		id: string;
		name?: string;
		question: string;
		choices: PreviewChoice[];
	};
};

export function McqPreview({ mcq }: McqPreviewProps) {
	const [choiceId, setChoiceId] = useState<string>("");
	const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onCheck() {
		if (!choiceId) {
			setError("Select a choice first");
			return;
		}
		setPending(true);
		setError(null);
		try {
			const response = await fetch(`/api/mcqs/${mcq.id}/attempts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ choiceId }),
			});
			const data: unknown = await response.json();
			if (
				response.status === 201 &&
				typeof data === "object" &&
				data !== null &&
				"isCorrect" in data &&
				typeof (data as { isCorrect: unknown }).isCorrect === "boolean"
			) {
				setResult((data as { isCorrect: boolean }).isCorrect ? "correct" : "incorrect");
				return;
			}
			setError("Could not record this attempt");
		} catch {
			setError("Could not record this attempt");
		} finally {
			setPending(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2>{mcq.name ?? "Preview"}</h2>
				</CardTitle>
				<CardDescription>Select one answer, then check whether it is correct.</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
			<p>{mcq.question}</p>
			<RadioGroup value={choiceId} onValueChange={setChoiceId}>
				{mcq.choices.map((choice) => (
					<label key={choice.id} className="flex items-center gap-2">
						<RadioGroupItem value={choice.id} aria-label={choice.body} />
						<span>{choice.body}</span>
					</label>
				))}
			</RadioGroup>
			{result ? (
				<Badge variant={result === "correct" ? "default" : "destructive"}>
					{result === "correct" ? "Correct" : "Incorrect"}
				</Badge>
			) : null}
			{error ? <p className="text-destructive">{error}</p> : null}
			<div className="flex gap-2">
				<Button type="button" disabled={pending} onClick={() => void onCheck()}>
					Check answer
				</Button>
				<Link href="/mcqs" className={buttonVariants({ variant: "outline" })}>
					Back to question bank
				</Link>
			</div>
			</CardContent>
		</Card>
	);
}
