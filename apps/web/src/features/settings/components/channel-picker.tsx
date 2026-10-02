import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxAnchor,
} from "#/components/ui/combobox";
import type { ChannelOption } from "#/features/guilds/lib/types";

type Props = {
	value: string[];
	onChange: (ids: string[]) => void;
	channels: ChannelOption[];
	disabled?: boolean;
};

export const ChannelPicker = ({
	value,
	onChange,
	channels,
	disabled,
}: Props) => {
	const anchor = useComboboxAnchor();
	// ids of deleted channels stay visible so they can be removed
	const selected = value.map(
		(id) => channels.find((channel) => channel.id === id) ?? { id, name: id },
	);

	return (
		<Combobox
			multiple
			items={channels}
			value={selected}
			onValueChange={(next) => onChange(next.map((channel) => channel.id))}
			itemToStringValue={(channel) => channel.name}
			isItemEqualToValue={(a, b) => a.id === b.id}
			disabled={disabled}
		>
			<ComboboxChips ref={anchor}>
				<ComboboxValue>
					{selected.map((channel) => (
						<ComboboxChip key={channel.id}>#{channel.name}</ComboboxChip>
					))}
				</ComboboxValue>
				<ComboboxChipsInput placeholder="Add channel" />
			</ComboboxChips>
			<ComboboxContent anchor={anchor}>
				<ComboboxEmpty>No channels found.</ComboboxEmpty>
				<ComboboxList>
					{(channel: ChannelOption) => (
						<ComboboxItem key={channel.id} value={channel}>
							#{channel.name}
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
};
