import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import type { RoleOption } from "#/features/guilds/lib/types";

const NONE = "__none__";

type Props = {
	value: string | null;
	onChange: (id: string | null) => void;
	roles: RoleOption[];
	disabled?: boolean;
};

export const RolePicker = ({ value, onChange, roles, disabled }: Props) => {
	const items = [
		{ value: NONE, label: "None" },
		...roles.map((role) => ({ value: role.id, label: role.name })),
	];

	return (
		<Select
			items={items}
			value={value ?? NONE}
			onValueChange={(next) => onChange(next === NONE ? null : next)}
			disabled={disabled}
		>
			<SelectTrigger>
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
