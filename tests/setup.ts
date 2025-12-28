import { $ } from "bun";
import { beforeAll } from "bun:test";

beforeAll(async () => {
	console.log("Starting Docker containers...");
	await $`docker compose up -d`.nothrow();
});
