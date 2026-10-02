import { Link } from "@tanstack/react-router";
import { Item, ItemContent, ItemMedia, ItemTitle } from "#/components/ui/item";
import { iconUrl } from "#/features/guilds/lib/guild-utils";
import type { GuildSummary } from "#/features/guilds/lib/types";

export const Guild = (guild: GuildSummary) => {
	return (
		<Item
			variant="outline"
			render={
				<Link to="/guilds/$guildId/settings" params={{ guildId: guild.id }} />
			}
		>
			<ItemMedia variant="image">
				{guild.icon ? (
					<img src={iconUrl(guild.id, guild.icon)} alt="" />
				) : (
					<div className="flex size-full items-center justify-center bg-muted text-sm font-medium text-muted-foreground">
						{guild.name.charAt(0).toUpperCase()}
					</div>
				)}
			</ItemMedia>
			<ItemContent>
				<ItemTitle>{guild.name}</ItemTitle>
			</ItemContent>
		</Item>
	);
};
