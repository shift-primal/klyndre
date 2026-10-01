import { createFileRoute } from "@tanstack/react-router";

const Home = () => {
	<div>
		<p>home</p>
	</div>;
};

export const Route = createFileRoute("/_authed/")({ component: Home });
