import { config } from "dotenv";

// Load the root .env no matter which package we're running from.
config({
	path: new URL("../../../.env", import.meta.url).pathname,
	quiet: true,
});
