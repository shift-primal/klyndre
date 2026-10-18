import { config } from "dotenv";

config({
	path: [
		new URL("../../../.env.local", import.meta.url).pathname,
		new URL("../../../.env", import.meta.url).pathname,
	],
	quiet: true,
});
