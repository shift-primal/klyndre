import { Button } from "#/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Switch } from "#/components/ui/switch";
import { Textarea } from "#/components/ui/textarea";
import type { ChannelOption, RoleOption } from "#/features/guilds/lib/types";
import { PresetBar } from "#/features/prompts/components/preset-bar";
import type { PromptKind } from "#/features/prompts/lib/prompt-kinds";
import { ChannelPicker } from "#/features/settings/components/channel-picker";
import { RolePicker } from "#/features/settings/components/role-picker";
import type { FieldSpec } from "#/features/settings/lib/fields";

type Props = {
	spec: FieldSpec;
	value: unknown;
	defaultValue: unknown;
	onChange: (value: unknown) => void;
	onBlur: () => void;
	invalid: boolean;
	errors: Array<{ message?: string } | undefined>;
	disabled?: boolean;
	channels: ChannelOption[];
	roles: RoleOption[];
};

const sameValue = (a: unknown, b: unknown) =>
	JSON.stringify(a) === JSON.stringify(b);

const Control = ({
	spec,
	value,
	onChange,
	onBlur,
	invalid,
	disabled,
	channels,
	roles,
}: Props) => {
	const id = spec.key;
	switch (spec.kind) {
		case "switch":
			return (
				<Switch
					id={id}
					name={id}
					checked={Boolean(value)}
					onCheckedChange={onChange}
					aria-invalid={invalid}
					disabled={disabled}
				/>
			);
		case "number":
			return (
				<Input
					id={id}
					name={id}
					type="number"
					min={spec.min}
					max={spec.max}
					step={spec.integer ? 1 : "any"}
					value={typeof value === "number" ? value : ""}
					onBlur={onBlur}
					aria-invalid={invalid}
					onChange={(event) =>
						onChange(
							event.target.value === ""
								? undefined
								: Number(event.target.value),
						)
					}
					disabled={disabled}
				/>
			);
		case "textarea":
		case "prompt":
			return (
				<div className="flex flex-col gap-2">
					<Textarea
						id={id}
						name={id}
						rows={8}
						value={String(value ?? "")}
						onBlur={onBlur}
						aria-invalid={invalid}
						onChange={(event) => onChange(event.target.value)}
						disabled={disabled}
					/>
					{spec.kind === "prompt" && !disabled && (
						<PresetBar
							kind={spec.key as PromptKind}
							text={String(value ?? "")}
							onLoad={onChange}
						/>
					)}
				</div>
			);
		case "channels":
			return (
				<ChannelPicker
					value={(value as string[]) ?? []}
					onChange={onChange}
					channels={channels}
					disabled={disabled}
				/>
			);
		case "role":
			return (
				<RolePicker
					value={(value as string | null) ?? null}
					onChange={onChange}
					roles={roles}
					disabled={disabled}
				/>
			);
		default:
			return (
				<Input
					id={id}
					name={id}
					value={String(value ?? "")}
					onBlur={onBlur}
					aria-invalid={invalid}
					onChange={(event) => onChange(event.target.value)}
					disabled={disabled}
				/>
			);
	}
};

export const SettingField = (props: Props) => {
	const { spec, value, defaultValue, onChange, invalid, errors, disabled } =
		props;
	const modified = !sameValue(value, defaultValue);
	const horizontal = spec.kind === "switch";

	return (
		<Field
			orientation={horizontal ? "horizontal" : "vertical"}
			data-invalid={invalid}
		>
			<div className="flex items-center justify-between gap-2">
				<FieldLabel htmlFor={spec.key}>{spec.label}</FieldLabel>
				{modified && !disabled && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onChange(defaultValue)}
					>
						Reset
					</Button>
				)}
			</div>
			<Control {...props} />
			{spec.description && (
				<FieldDescription>{spec.description}</FieldDescription>
			)}
			{invalid && <FieldError errors={errors} />}
		</Field>
	);
};
