import Link from "next/link";
import { McqEditorForm } from "@/components/mcqs/mcq-editor-form";

export default function NewMcqPage() {
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-xl flex-col gap-4">
				<Link href="/mcqs" className="text-sm underline-offset-4 hover:underline">
					Back to question bank
				</Link>
				<McqEditorForm />
			</div>
		</div>
	);
}
