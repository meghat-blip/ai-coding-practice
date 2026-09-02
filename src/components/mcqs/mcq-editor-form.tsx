"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { getStoredUserId } from "@/lib/client-user";

export type EditorChoice = {
	id?: string;
	body: string;
	isCorrect: boolean;
};

export type EditorMcq = {
	name: string;
	question: string;
	choices: EditorChoice[];
};

type McqEditorFormProps = {
	mcqId?: string;
	initialMcq?: EditorMcq;
};

const emptyChoices: EditorChoice[] = [
	{ body: "", isCorrect: false },
	{ body: "", isCorrect: false },
];

export function McqEditorForm({ mcqId, initialMcq }: McqEditorFormProps) {
	const router = useRouter();
	const [name, setName] = useState(initialMcq?.name ?? "");
	const [question, setQuestion] = useState(initialMcq?.question ?? "");
	const [choices, setChoices] = useState<EditorChoice[]>(initialMcq?.choices ?? emptyChoices);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const correctIndex = choices.findIndex((choice) => choice.isCorrect);

	function setCorrect(index: number) {
		setChoices((current) => current.map((choice, i) => ({ ...choice, isCorrect: i === index })));
	}

	function addChoice() {
		if (choices.length >= 6) {
			return;
		}
		setChoices((current) => [...current, { body: "", isCorrect: false }]);
	}

	function removeChoice(index: number) {
		if (choices.length <= 2) {
			return;
		}
		setChoices((current) => current.filter((_, i) => i !== index));
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmedName = name.trim();
		const trimmedQuestion = question.trim();
		const trimmedChoices = choices.map((choice) => ({
			...choice,
			body: choice.body.trim(),
		}));

		if (!trimmedName || !trimmedQuestion || trimmedChoices.some((choice) => !choice.body)) {
			setError("Name, question, and every choice are required");
			return;
		}
		if (trimmedChoices.filter((choice) => choice.isCorrect).length !== 1) {
			setError("Mark exactly one choice as correct");
			return;
		}

		if (!mcqId) {
			const createdBy = getStoredUserId();
			if (!createdBy) {
				setError("Please log in before creating a question.");
				return;
			}
			setPending(true);
			setError(null);
			try {
				const response = await fetch("/api/mcqs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: trimmedName,
						question: trimmedQuestion,
						createdBy,
						choices: trimmedChoices.map((choice) => ({
							body: choice.body,
							isCorrect: choice.isCorrect,
						})),
					}),
				});
				if (response.status === 201) {
					router.push("/mcqs");
					return;
				}
				setError("Could not save this question");
			} catch {
				setError("Could not save this question");
			} finally {
				setPending(false);
			}
			return;
		}

		setPending(true);
		setError(null);
		try {
			const response = await fetch(`/api/mcqs/${mcqId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: trimmedName,
					question: trimmedQuestion,
					choices: trimmedChoices.map((choice) => ({
						...(choice.id ? { id: choice.id } : {}),
						body: choice.body,
						isCorrect: choice.isCorrect,
					})),
				}),
			});
			if (response.ok) {
				router.push("/mcqs");
				return;
			}
			setError("Could not save this question");
		} catch {
			setError("Could not save this question");
		} finally {
			setPending(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2>{mcqId ? "Edit question" : "Create question"}</h2>
				</CardTitle>
				<CardDescription>
					{mcqId
						? "Update the stem and choices. The original author is not changed."
						: "Add a short name, the question stem, and two to six choices."}
				</CardDescription>
			</CardHeader>
			<CardContent>
		<form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-6">
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="mcq-name">Name</FieldLabel>
					<Input id="mcq-name" value={name} onChange={(event) => setName(event.target.value)} />
					<FieldDescription>Short title shown in the question bank.</FieldDescription>
				</Field>
				<Field>
					<FieldLabel htmlFor="mcq-question">Question</FieldLabel>
					<Textarea
						id="mcq-question"
						value={question}
						onChange={(event) => setQuestion(event.target.value)}
					/>
					<FieldDescription>The stem students see in preview.</FieldDescription>
				</Field>
				<Field>
					<FieldDescription>Mark one choice as the correct answer.</FieldDescription>
				</Field>
				<RadioGroup
					value={correctIndex >= 0 ? String(correctIndex) : ""}
					onValueChange={(value) => setCorrect(Number(value))}
					className="gap-4"
				>
					{choices.map((choice, index) => (
						<Field key={choice.id ?? `new-${index}`}>
							<FieldLabel htmlFor={`choice-${index}`}>Choice {index + 1}</FieldLabel>
							<div className="flex items-start gap-2">
								<Input
									id={`choice-${index}`}
									value={choice.body}
									onChange={(event) =>
										setChoices((current) =>
											current.map((item, i) =>
												i === index ? { ...item, body: event.target.value } : item,
											),
										)
									}
								/>
								<div className="flex items-center gap-2 pt-1">
									<RadioGroupItem
										value={String(index)}
										id={`correct-${index}`}
										aria-label={`Choice ${index + 1} is correct`}
									/>
									{choices.length > 2 ? (
										<Button
											type="button"
											variant="outline"
											onClick={() => removeChoice(index)}
										>
											Remove choice {index + 1}
										</Button>
									) : null}
								</div>
							</div>
						</Field>
					))}
				</RadioGroup>
				<Button type="button" variant="outline" disabled={choices.length >= 6} onClick={addChoice}>
					Add choice
				</Button>
				{error ? <FieldError>{error}</FieldError> : null}
				{error?.match(/log in/i) ? (
					<p>
						<Link href="/login" className="underline">
							Log in
						</Link>
					</p>
				) : null}
				<div className="flex gap-2">
					<Button type="submit" disabled={pending}>
						Save
					</Button>
					<Button type="button" variant="outline" onClick={() => router.push("/mcqs")}>
						Cancel
					</Button>
				</div>
			</FieldGroup>
		</form>
			</CardContent>
		</Card>
	);
}
