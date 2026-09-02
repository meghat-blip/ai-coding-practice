"use client";

import { useEffect, useState } from "react";
import { McqPreview } from "@/components/mcqs/mcq-preview";

type LoadedMcq = {
	id: string;
	name: string;
	question: string;
	choices: { id: string; body: string }[];
};

type LoadState =
	| { status: "loading" }
	| { status: "not-found" }
	| { status: "error"; message: string }
	| { status: "ready"; mcq: LoadedMcq };

function parsePreviewMcq(data: unknown): LoadedMcq | null {
	if (typeof data !== "object" || data === null) {
		return null;
	}
	if (!("id" in data) || !("question" in data) || !("choices" in data) || !Array.isArray(data.choices)) {
		return null;
	}
	const loaded = data as LoadedMcq;
	return {
		id: loaded.id,
		name: loaded.name,
		question: loaded.question,
		choices: loaded.choices.map((choice) => ({ id: choice.id, body: choice.body })),
	};
}

export function McqPreviewLoader({ mcqId }: { mcqId: string }) {
	const [state, setState] = useState<LoadState>({ status: "loading" });

	useEffect(() => {
		let cancelled = false;
		fetch(`/api/mcqs/${mcqId}`)
			.then(async (response) => {
				if (response.status === 404) {
					return { kind: "not-found" as const };
				}
				if (!response.ok) {
					return { kind: "error" as const };
				}
				const data: unknown = await response.json();
				return { kind: "body" as const, data };
			})
			.then((result) => {
				if (cancelled) {
					return;
				}
				if (result.kind === "not-found") {
					setState({ status: "not-found" });
					return;
				}
				if (result.kind === "error") {
					setState({ status: "error", message: "Could not load this question" });
					return;
				}
				const parsed = parsePreviewMcq(result.data);
				if (parsed) {
					setState({ status: "ready", mcq: parsed });
					return;
				}
				setState({ status: "error", message: "Could not load this question" });
			})
			.catch(() => {
				if (!cancelled) {
					setState({ status: "error", message: "Could not load this question" });
				}
			});
		return () => {
			cancelled = true;
		};
	}, [mcqId]);

	if (state.status === "loading") {
		return <p className="text-muted-foreground">Loading question…</p>;
	}
	if (state.status === "not-found") {
		return <p className="text-destructive">Question not found</p>;
	}
	if (state.status === "error") {
		return <p className="text-destructive">{state.message}</p>;
	}
	return <McqPreview mcq={state.mcq} />;
}
