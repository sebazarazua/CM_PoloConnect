import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
// A clean clone/container has no ignored runtime directory yet.
mkdirSync(resolve(".local"), { recursive: true });
