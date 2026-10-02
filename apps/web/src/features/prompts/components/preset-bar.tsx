import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { usePresetActions } from "#/features/prompts/hooks/use-preset-actions";
import { usePresets } from "#/features/prompts/hooks/use-presets";
import type { PromptKind } from "#/features/prompts/lib/prompt-kinds";

type Props = {
	kind: PromptKind;
	// what is currently written, saved as a preset on "Save as preset"
	text: string;
	onLoad: (text: string) => void;
};

export const PresetBar = ({ kind, text, onLoad }: Props) => {
	const { data: presets = [] } = usePresets(kind);
	const { save, remove } = usePresetActions(kind);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [name, setName] = useState("");

	const items = presets.map((preset) => ({
		value: String(preset.id),
		label: preset.name,
	}));
	const selected = presets.find((preset) => String(preset.id) === selectedId);

	return (
		<div className="flex flex-col gap-2 rounded-lg border p-3">
			<div className="flex gap-2">
				<Select
					items={items}
					value={selectedId}
					onValueChange={(next) => {
						setSelectedId(next);
						const preset = presets.find((p) => String(p.id) === next);
						if (preset) setName(preset.name);
					}}
				>
					<SelectTrigger className="flex-1">
						<SelectValue
							placeholder={
								presets.length ? "Saved presets" : "No saved presets yet"
							}
						/>
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{items.map((item) => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
				<Button
					type="button"
					variant="outline"
					disabled={!selected}
					onClick={() => selected && onLoad(selected.content)}
				>
					Load
				</Button>
				<Button
					type="button"
					variant="outline"
					disabled={!selected || remove.isPending}
					onClick={() =>
						selected &&
						remove.mutate(selected.id, {
							onSuccess: () => {
								setSelectedId(null);
								setName("");
							},
						})
					}
				>
					Delete
				</Button>
			</div>
			<div className="flex gap-2">
				<Input
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="Preset name"
				/>
				<Button
					type="button"
					disabled={!name.trim() || !text.trim() || save.isPending}
					onClick={() => save.mutate({ name: name.trim(), content: text })}
				>
					Save as preset
				</Button>
			</div>
		</div>
	);
};
