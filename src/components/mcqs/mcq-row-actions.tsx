"use client";

import { useState } from "react";
import { EllipsisVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type McqRowActionsProps = {
	mcq: { id: string; name: string };
	onDeleted: () => void;
};

export function McqRowActions({ mcq, onDeleted }: McqRowActionsProps) {
	const router = useRouter();
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function confirmDelete() {
		setPending(true);
		setError(null);
		try {
			const response = await fetch(`/api/mcqs/${mcq.id}`, { method: "DELETE" });
			if (!response.ok) {
				setError("Could not delete this question");
				return;
			}
			setConfirmOpen(false);
			onDeleted();
		} catch {
			setError("Could not delete this question");
		} finally {
			setPending(false);
		}
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={<Button variant="ghost" size="icon" />}
					aria-label={`Actions for ${mcq.name}`}
				>
					<EllipsisVertical />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={() => router.push(`/mcqs/${mcq.id}/edit`)}>Edit</DropdownMenuItem>
					<DropdownMenuItem onClick={() => router.push(`/mcqs/${mcq.id}/preview`)}>Preview</DropdownMenuItem>
					<DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete this question?</DialogTitle>
						<DialogDescription>
							This removes {mcq.name} and its choices. This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					{error ? <p className="text-destructive">{error}</p> : null}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
							Cancel
						</Button>
						<Button type="button" variant="destructive" disabled={pending} onClick={() => void confirmDelete()}>
							Delete question
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
