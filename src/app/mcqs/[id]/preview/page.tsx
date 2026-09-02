"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { McqPreviewLoader } from "@/components/mcqs/mcq-preview-loader";

export default function PreviewMcqPage() {
	const { id } = useParams<{ id: string }>();

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-xl flex-col gap-4">
				<Link href="/mcqs" className="text-sm underline-offset-4 hover:underline">
					Back to question bank
				</Link>
				<McqPreviewLoader mcqId={id} />
			</div>
		</div>
	);
}
