import type { Generated } from "kysely";

export interface Database {
	todo: TodoTable;
}

export interface TodoTable {
	id: Generated<number>;
	title: string;
	description?: string;
}
