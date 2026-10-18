import { Pencil, Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Textarea } from "#/components/ui/textarea";

type Props = {
	id: string;
	label: string;
	value: string[];
	onChange: (value: string[]) => void;
	disabled?: boolean;
};

// what the dialog is doing: adding a new item, or editing the one at index
type Editing = { index: number | null; text: string };

export const ListField = ({ id, label, value, onChange, disabled }: Props) => {
	const [editing, setEditing] = useState<Editing | null>(null);
	const text = editing?.text.trim() ?? "";

	const save = () => {
		if (!editing || !text) return;
		onChange(
			editing.index === null
				? [...value, text]
				: value.map((item, i) => (i === editing.index ? text : item)),
		);
		setEditing(null);
	};

	return (
		<div id={id} className="flex flex-col gap-2">
			{value.length === 0 ? (
				<p className="text-muted-foreground text-sm">Nothing yet.</p>
			) : (
				<ul className="flex flex-col gap-1">
					{value.map((item, index) => (
						<li
							// items can repeat, and the list only changes as a whole
							// biome-ignore lint/suspicious/noArrayIndexKey: see above
							key={index}
							className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
						>
							<span className="flex-1 whitespace-pre-wrap">{item}</span>
							{!disabled && (
								<div className="-my-1 flex gap-1">
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label={`Edit "${item}"`}
										onClick={() => setEditing({ index, text: item })}
									>
										<Pencil />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label={`Remove "${item}"`}
										onClick={() =>
											onChange(value.filter((_, i) => i !== index))
										}
									>
										<X />
									</Button>
								</div>
							)}
						</li>
					))}
				</ul>
			)}
			{!disabled && (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="self-start"
					onClick={() => setEditing({ index: null, text: "" })}
				>
					<Plus />
					Add
				</Button>
			)}

			<Dialog
				open={editing !== null}
				onOpenChange={(open) => !open && setEditing(null)}
			>
				<DialogContent>
					<form
						className="flex flex-col gap-4"
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							save();
						}}
					>
						<DialogHeader>
							<DialogTitle>
								{editing?.index === null ? "Add to" : "Edit in"}{" "}
								{label.toLowerCase()}
							</DialogTitle>
						</DialogHeader>
						<Textarea
							autoFocus
							rows={3}
							aria-label={label}
							value={editing?.text ?? ""}
							onChange={(event) =>
								setEditing(
									(current) =>
										current && { ...current, text: event.target.value },
								)
							}
							onKeyDown={(event) => {
								// enter saves, shift+enter makes a new line
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									save();
								}
							}}
						/>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setEditing(null)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={!text}>
								{editing?.index === null ? "Add" : "Save"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
};
