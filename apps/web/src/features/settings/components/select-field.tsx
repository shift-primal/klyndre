import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";

type Props = {
	id: string;
	value: string;
	options: string[];
	onChange: (value: string) => void;
	invalid: boolean;
	disabled?: boolean;
};

const labelOf = (option: string) =>
	option.charAt(0).toUpperCase() + option.slice(1);

export const SelectField = ({
	id,
	value,
	options,
	onChange,
	invalid,
	disabled,
}: Props) => {
	const items = options.map((option) => ({
		value: option,
		label: labelOf(option),
	}));

	return (
		<Select
			items={items}
			value={value}
			onValueChange={(next) => {
				if (next !== null) onChange(next);
			}}
			disabled={disabled}
		>
			<SelectTrigger id={id} aria-invalid={invalid}>
				<SelectValue />
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
	);
};
