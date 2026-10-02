import { ItemGroup } from "#/components/ui/item";
import { Guild } from "#/features/guilds/components/guild";
import { useGuilds } from "#/features/guilds/hooks/use-guilds";

export const GuildList = () => {
	const { data: guilds } = useGuilds();

	if (guilds.length === 0) return <p>The bot isn't in any servers yet.</p>;

	return (
		<ItemGroup>
			{guilds.map((guild) => (
				<Guild key={guild.id} {...guild} />
			))}
		</ItemGroup>
	);
};
