#!/usr/bin/env node

import { createCli } from "./cli/index.js";

const program = createCli();
await program.parseAsync();
