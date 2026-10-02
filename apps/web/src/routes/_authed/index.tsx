import { createFileRoute } from "@tanstack/react-router";

const Home = () => <p>home</p>;

export const Route = createFileRoute("/_authed/")({ component: Home });
