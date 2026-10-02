import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";
import { toast } from "#/components/ui/toast";
import {
	getYoutubeCookieInfo,
	saveYoutubeCookies,
} from "#/features/secrets/server/secrets.functions";

export const youtubeCookieInfoQuery = {
	queryKey: ["secrets", "youtube-cookies"],
	queryFn: () => getYoutubeCookieInfo(),
};

type Props = { info: Awaited<ReturnType<typeof getYoutubeCookieInfo>> };

export const YoutubeCookiesForm = ({ info }: Props) => {
	const queryClient = useQueryClient();
	const [value, setValue] = useState("");

	const save = useMutation({
		mutationFn: () => saveYoutubeCookies({ data: { value } }),
		onSuccess: (saved) => {
			queryClient.setQueryData(youtubeCookieInfoQuery.queryKey, saved);
			setValue("");
			toast.add({ type: "success", title: "Cookies saved" });
		},
		onError: (error) => {
			toast.add({
				type: "error",
				title: "Couldn't save cookies",
				description: error.message,
			});
		},
	});

	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				save.mutate();
			}}
		>
			<h2 className="font-semibold text-lg">YouTube cookies</h2>
			<p className="text-muted-foreground text-sm">
				{info.isSet
					? `Set, last updated ${new Date(info.updatedAt ?? 0).toLocaleString()}.`
					: "Not set."}{" "}
				Paste the contents of a cookies.txt export. The saved value is never
				shown again, and the bot picks it up right away.
			</p>
			<Textarea
				value={value}
				onChange={(event) => setValue(event.target.value)}
				placeholder="# Netscape HTTP Cookie File"
				rows={8}
				className="font-mono"
				autoComplete="off"
				spellCheck={false}
			/>
			<div>
				<Button type="submit" disabled={!value.trim() || save.isPending}>
					Save cookies
				</Button>
			</div>
		</form>
	);
};
