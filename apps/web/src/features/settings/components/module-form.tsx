import { type ModuleName, moduleSchemas } from "@klyndre/config/schemas";
import { useForm } from "@tanstack/react-form";
import { useEffect, useRef } from "react";
import { Button } from "#/components/ui/button";
import { FieldGroup } from "#/components/ui/field";
import { useGuildOptions } from "#/features/guilds/hooks/use-guild-options";
import { SettingField } from "#/features/settings/components/setting-field";
import { useGuildSettings } from "#/features/settings/hooks/use-guild-settings";
import { useSaveSettings } from "#/features/settings/hooks/use-save-settings";
import { defaultsFor, fieldsFor } from "#/features/settings/lib/fields";

type Props = {
	guildId: string;
	module: ModuleName;
	readOnly: boolean;
	onDirtyChange: (dirty: boolean) => void;
};

const DirtyReporter = ({
	dirty,
	onChange,
}: {
	dirty: boolean;
	onChange: (dirty: boolean) => void;
}) => {
	// the callback changes identity every render, so keep it out of the effect deps
	const latest = useRef(onChange);
	useEffect(() => {
		latest.current = onChange;
	});
	useEffect(() => latest.current(dirty), [dirty]);
	useEffect(() => () => latest.current(false), []);
	return null;
};

export const ModuleForm = ({
	guildId,
	module,
	readOnly,
	onDirtyChange,
}: Props) => {
	const { data: settings } = useGuildSettings(guildId, module);
	const { data: options } = useGuildOptions(guildId);
	const save = useSaveSettings(guildId, module);
	const fields = fieldsFor(module);
	const defaults = defaultsFor(module);

	const form = useForm({
		defaultValues: settings as Record<string, unknown>,
		validators: { onChange: moduleSchemas[module] as never },
		onSubmit: async ({ value, formApi }) => {
			const saved = await save.mutateAsync(value);
			formApi.reset(saved as Record<string, unknown>);
		},
	});

	return (
		<form
			className="flex flex-col gap-6"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void form.handleSubmit();
			}}
		>
			<form.Subscribe selector={(state) => state.isDirty}>
				{(dirty) => <DirtyReporter dirty={dirty} onChange={onDirtyChange} />}
			</form.Subscribe>
			<FieldGroup>
				{fields.map((spec) => (
					<form.Field key={spec.key} name={spec.key}>
						{(field) => (
							<SettingField
								spec={spec}
								value={field.state.value}
								defaultValue={defaults[spec.key]}
								onChange={field.handleChange}
								onBlur={field.handleBlur}
								invalid={
									field.state.meta.isTouched && !field.state.meta.isValid
								}
								errors={
									field.state.meta.errors as unknown as Array<{
										message?: string;
									}>
								}
								disabled={readOnly}
								channels={options.channels}
								roles={options.roles}
							/>
						)}
					</form.Field>
				))}
			</FieldGroup>

			{readOnly ? (
				<p className="text-sm text-muted-foreground">
					You have read-only access.
				</p>
			) : (
				<form.Subscribe
					selector={(state) => ({
						dirty: state.isDirty,
						canSubmit: state.canSubmit,
						submitting: state.isSubmitting,
					})}
				>
					{({ dirty, canSubmit, submitting }) => (
						<div className="flex gap-2">
							<Button
								type="submit"
								disabled={!dirty || !canSubmit || submitting}
							>
								{submitting ? "Saving…" : "Save changes"}
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={!dirty || submitting}
								onClick={() => form.reset()}
							>
								Discard
							</Button>
						</div>
					)}
				</form.Subscribe>
			)}
		</form>
	);
};
