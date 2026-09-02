import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
			<div className="flex max-w-md flex-col items-center gap-2 text-center">
				<h1 className="text-3xl font-medium">QuizMaker</h1>
				<p className="text-muted-foreground">
					A shared test bank for teachers. Start by creating an account or logging in.
				</p>
			</div>
			<div className="flex gap-3">
				<Link href="/register" className={cn(buttonVariants())}>
					Register
				</Link>
				<Link href="/login" className={cn(buttonVariants({ variant: "outline" }))}>
					Log in
				</Link>
			</div>
		</main>
	);
}
