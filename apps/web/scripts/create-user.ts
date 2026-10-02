import { parseArgs } from "node:util";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const {
	positionals: [email, password, name],
	values: { admin },
} = parseArgs({
	allowPositionals: true,
	options: { admin: { type: "boolean" } },
});
if (!email || !password) {
	console.error("Usage: pnpm create:user <email> <password> [name] [--admin]");
	process.exit(1);
}

const { auth } = await import("#/features/auth/server/auth");
const { db } = await import("@klyndre/db");
const ctx = await auth.$context;

try {
	const { minPasswordLength } = ctx.password.config;
	if (password.length < minPasswordLength) {
		throw new Error(
			`Password must be at least ${minPasswordLength} characters`,
		);
	}
	if (await ctx.internalAdapter.findUserByEmail(email)) {
		throw new Error(`${email} already has an account`);
	}
	const user = await ctx.internalAdapter.createUser(
		{
			email,
			name: name ?? email.split("@")[0] ?? email,
			emailVerified: true,
			role: admin ? "admin" : "viewer",
		},
		{ method: "admin" },
	);
	await ctx.internalAdapter.linkAccount({
		userId: user.id,
		providerId: "credential",
		accountId: user.id,
		password: await ctx.password.hash(password),
	});
	console.log(`Created ${email}`);
} catch (error) {
	console.error((error as Error).message);
	process.exitCode = 1;
} finally {
	await db.$client.end();
}
