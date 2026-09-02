"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { McqEditorLoader } from "@/components/mcqs/mcq-editor-loader";

export default function EditMcqPage() {
	const { id } = useParams<{ id: string }>();

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-xl flex-col gap-4">
				<Link href="/mcqs" className="text-sm underline-offset-4 hover:underline">
					Back to question bank
				</Link>
				<McqEditorLoader mcqId={id} />
			</div>
		</div>
	);
}
