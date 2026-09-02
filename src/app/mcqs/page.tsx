import { LogoutButton } from "@/components/auth/logout-button";
import { McqList } from "@/components/mcqs/mcq-list";

export default function McqsPage() {
	return (
		<main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 p-6 md:p-10">
			<div className="flex items-start justify-between gap-4">
				<div className="flex flex-col gap-2">
					<h1 className="text-2xl font-medium">Question bank</h1>
					<p className="text-muted-foreground">
						Questions on this instance are listed for everyone. Created-by records who wrote them; identity
						is not stored in a server session yet.
					</p>
				</div>
				<LogoutButton />
			</div>
			<McqList />
		</main>
	);
}
