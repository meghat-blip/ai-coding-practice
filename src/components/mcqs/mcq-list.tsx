"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { McqRowActions } from "@/components/mcqs/mcq-row-actions";

type McqListItem = {
	id: string;
	name: string;
	question: string;
};

function parseItems(data: unknown): McqListItem[] | null {
	if (typeof data !== "object" || data === null || !("items" in data) || !Array.isArray(data.items)) {
		return null;
	}
	return data.items.map((item: McqListItem) => ({
		id: item.id,
		name: item.name,
		question: item.question,
	}));
}

export function McqList() {
	const [items, setItems] = useState<McqListItem[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	function applyPayload(data: unknown) {
		const parsed = parseItems(data);
		if (parsed) {
			setItems(parsed);
			setError(null);
			return;
		}
		setError("Could not load questions");
	}

	async function reload() {
		try {
			const response = await fetch("/api/mcqs");
			applyPayload(await response.json());
		} catch {
			setError("Could not load questions");
		}
	}

	useEffect(() => {
		let cancelled = false;
		fetch("/api/mcqs")
			.then((response) => response.json())
			.then((data: unknown) => {
				if (!cancelled) {
					applyPayload(data);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setError("Could not load questions");
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex justify-end">
				<Link href="/mcqs/new" className={buttonVariants()}>
					Create question
				</Link>
			</div>
			{error ? <p className="text-destructive">{error}</p> : null}
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Question</TableHead>
						<TableHead className="w-16">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{items?.map((item) => (
						<TableRow key={item.id}>
							<TableCell className="font-medium">{item.name}</TableCell>
							<TableCell className="max-w-md truncate">{item.question}</TableCell>
							<TableCell>
								<McqRowActions mcq={item} onDeleted={() => void reload()} />
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			{items && items.length === 0 ? <p className="text-muted-foreground">No questions yet.</p> : null}
		</div>
	);
}
