import { CHARACTER_TEXT_MAX } from "@klyndre/db/character";

import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "#/components/ui/field";
import { Switch } from "#/components/ui/switch";
import { Textarea } from "#/components/ui/textarea";
import type { ItemFields as Fields } from "#/features/character/hooks/use-character-actions";

type Props = {
	id: string;
	value: Fields;
	onChange: (value: Fields) => void;
};

export const isValidItem = ({ text }: Fields) =>
	text.trim().length > 0 && text.trim().length <= CHARACTER_TEXT_MAX;

export const ItemFields = ({ id, value, onChange }: Props) => {
	const set = (patch: Partial<Fields>) => onChange({ ...value, ...patch });

	return (
		<div className="flex flex-col gap-3">
			<Field>
				<Textarea
					id={`${id}-text`}
					aria-label="Text"
					rows={2}
					value={value.text}
					maxLength={CHARACTER_TEXT_MAX}
					onChange={(event) => set({ text: event.target.value })}
				/>
				<FieldDescription>
					{value.text.trim().length} / {CHARACTER_TEXT_MAX}
				</FieldDescription>
			</Field>
			<Field orientation="horizontal">
				<Switch
					id={`${id}-locked`}
					checked={value.locked}
					onCheckedChange={(locked) => set({ locked })}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${id}-locked`}>Locked</FieldLabel>
				</FieldContent>
			</Field>
		</div>
	);
};
