import { type ModuleName, moduleSchemas } from "@klyndre/config/schemas";
import { useForm } from "@tanstack/react-form";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "#/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "#/components/ui/collapsible";
import { FieldGroup } from "#/components/ui/field";
import { useGuildOptions } from "#/features/guilds/hooks/use-guild-options";
import { SettingField } from "#/features/settings/components/setting-field";
import { useGuildSettings } from "#/features/settings/hooks/use-guild-settings";
import { useSaveSettings } from "#/features/settings/hooks/use-save-settings";
import {
	defaultsFor,
	type FieldSpec,
	fieldsFor,
	sameValue,
} from "#/features/settings/lib/fields";

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
	const tunables = fields.filter((spec) => !spec.advanced);
	const advanced = fields.filter((spec) => spec.advanced);
	const defaults = defaultsFor(module);

	const form = useForm({
		defaultValues: settings as Record<string, unknown>,
		validators: { onChange: moduleSchemas[module] as never },
		onSubmit: async ({ value, formApi }) => {
			const saved = await save.mutateAsync(value);
			formApi.reset(saved as Record<string, unknown>);
		},
	});

	const renderField = (spec: FieldSpec) => (
		<form.Field key={spec.key} name={spec.key}>
			{(field) => (
				<SettingField
					spec={spec}
					value={field.state.value}
					defaultValue={defaults[spec.key]}
					onChange={field.handleChange}
					onBlur={field.handleBlur}
					invalid={field.state.meta.isTouched && !field.state.meta.isValid}
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
	);

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
			<FieldGroup>{tunables.map(renderField)}</FieldGroup>

			{advanced.length > 0 && (
				<div className="border-t pt-4">
					<Collapsible>
						<CollapsibleTrigger
							render={
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="group -ml-2"
								/>
							}
						>
							<ChevronRight className="transition-transform group-data-[panel-open]:rotate-90" />
							Advanced
							<form.Subscribe
								selector={(state) =>
									advanced.filter(
										(spec) =>
											!sameValue(state.values[spec.key], defaults[spec.key]),
									).length
								}
							>
								{(changed) =>
									changed > 0 && (
										<span className="text-muted-foreground">
											({changed} changed)
										</span>
									)
								}
							</form.Subscribe>
						</CollapsibleTrigger>
						<CollapsibleContent keepMounted>
							<div className="pt-5">
								<FieldGroup>{advanced.map(renderField)}</FieldGroup>
							</div>
						</CollapsibleContent>
					</Collapsible>
				</div>
			)}

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
