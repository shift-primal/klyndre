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
	// built-in preset, listed first, can't be deleted or overwritten
	defaultText: string;
	onLoad: (text: string) => void;
};

const DEFAULT_ID = "default";
const DEFAULT_NAME = "Default";

export const PresetBar = ({ kind, text, defaultText, onLoad }: Props) => {
	const { data: presets = [] } = usePresets(kind);
	const { save, remove } = usePresetActions(kind);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [name, setName] = useState("");

	const items = [
		{ value: DEFAULT_ID, label: DEFAULT_NAME },
		...presets.map((preset) => ({
			value: String(preset.id),
			label: preset.name,
		})),
	];
	const selected = presets.find((preset) => String(preset.id) === selectedId);
	const isDefault = selectedId === DEFAULT_ID;
	const reservedName = name.trim().toLowerCase() === DEFAULT_NAME.toLowerCase();

	return (
		<div className="flex flex-col gap-2 rounded-lg border p-3">
			<div className="flex gap-2">
				<Select
					items={items}
					value={selectedId}
					onValueChange={(next) => {
						setSelectedId(next);
						const preset = presets.find((p) => String(p.id) === next);
						setName(preset?.name ?? "");
					}}
				>
					<SelectTrigger className="flex-1">
						<SelectValue placeholder="Presets" />
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
					disabled={!selected && !isDefault}
					onClick={() => {
						if (isDefault) onLoad(defaultText);
						else if (selected) onLoad(selected.content);
					}}
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
					disabled={
						!name.trim() || reservedName || !text.trim() || save.isPending
					}
					onClick={() => save.mutate({ name: name.trim(), content: text })}
				>
					Save as preset
				</Button>
			</div>
		</div>
	);
};
