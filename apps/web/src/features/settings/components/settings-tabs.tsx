import type { ModuleName } from "@klyndre/config/schemas";
import { useBlocker } from "@tanstack/react-router";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { ModuleForm } from "#/features/settings/components/module-form";
import { moduleLabel, moduleNames } from "#/features/settings/lib/fields";

type Props = {
	guildId: string;
	tab: ModuleName;
	onTabChange: (tab: ModuleName) => void;
	readOnly: boolean;
};

export const SettingsTabs = ({
	guildId,
	tab,
	onTabChange,
	readOnly,
}: Props) => {
	const [dirty, setDirty] = useState<Partial<Record<ModuleName, boolean>>>({});
	const anyDirty = Object.values(dirty).some(Boolean);

	// switching tabs only changes the search param, so only leaving the page asks
	useBlocker({
		shouldBlockFn: ({ current, next }) => {
			if (!anyDirty || current.pathname === next.pathname) return false;
			return !window.confirm("You have unsaved changes. Leave without saving?");
		},
		enableBeforeUnload: anyDirty,
	});

	return (
		<Tabs value={tab} onValueChange={(next) => onTabChange(next as ModuleName)}>
			<TabsList>
				{moduleNames.map((name) => (
					<TabsTrigger key={name} value={name}>
						{moduleLabel(name)}
						{dirty[name] && <span title="Unsaved changes"> •</span>}
					</TabsTrigger>
				))}
			</TabsList>
			{moduleNames.map((name) => (
				<TabsContent key={name} value={name} keepMounted className="mt-4">
					<ModuleForm
						guildId={guildId}
						module={name}
						readOnly={readOnly}
						onDirtyChange={(isDirty) =>
							setDirty((previous) =>
								previous[name] === isDirty
									? previous
									: { ...previous, [name]: isDirty },
							)
						}
					/>
				</TabsContent>
			))}
		</Tabs>
	);
};
