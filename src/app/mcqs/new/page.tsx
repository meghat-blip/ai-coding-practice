import Link from "next/link";
import { McqEditorForm } from "@/components/mcqs/mcq-editor-form";

export default function NewMcqPage() {
	return (
		<main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-2xl font-medium">Create question</h1>
				<Link href="/mcqs" className="text-sm underline-offset-4 hover:underline">
					Back
				</Link>
			</div>
			<McqEditorForm />
		</main>
	);
}
