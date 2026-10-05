import { LORE_KEY_MAX, LORE_NOTES_MAX } from "@klyndre/db/lore";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Switch } from "#/components/ui/switch";
import { Textarea } from "#/components/ui/textarea";
import type { LoreFields as Fields } from "#/features/lore/hooks/use-lore-actions";

type Props = {
	id: string;
	value: Fields;
	onChange: (value: Fields) => void;
	disabled?: boolean;
};

export const isValidLore = ({ key, notes }: Fields) =>
	key.trim().length > 0 &&
	key.trim().length <= LORE_KEY_MAX &&
	notes.trim().length > 0 &&
	notes.trim().length <= LORE_NOTES_MAX;

export const LoreFields = ({ id, value, onChange, disabled }: Props) => {
	const set = (patch: Partial<Fields>) => onChange({ ...value, ...patch });

	return (
		<div className="flex flex-col gap-3">
			<Field>
				<FieldLabel htmlFor={`${id}-key`}>Key</FieldLabel>
				<Input
					id={`${id}-key`}
					value={value.key}
					maxLength={LORE_KEY_MAX}
					placeholder="A name like Arne, or a short label like the cousin"
					onChange={(event) => set({ key: event.target.value })}
					disabled={disabled}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={`${id}-notes`}>Notes</FieldLabel>
				<Textarea
					id={`${id}-notes`}
					rows={3}
					value={value.notes}
					maxLength={LORE_NOTES_MAX}
					onChange={(event) => set({ notes: event.target.value })}
					disabled={disabled}
				/>
				<FieldDescription>
					{value.notes.trim().length} / {LORE_NOTES_MAX}
				</FieldDescription>
			</Field>
			<Field orientation="horizontal">
				<Switch
					id={`${id}-locked`}
					checked={value.locked}
					onCheckedChange={(locked) => set({ locked })}
					disabled={disabled}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${id}-locked`}>Locked</FieldLabel>
					<FieldDescription>
						Always in the prompt, and the bot never changes it. Keep these few,
						every one makes each reply's prompt longer.
					</FieldDescription>
				</FieldContent>
			</Field>
		</div>
	);
};
