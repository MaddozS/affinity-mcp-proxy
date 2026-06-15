import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const packageMetadata = require("./package.json");
export const PACKAGE_NAME = packageMetadata.name;
export const PACKAGE_VERSION = packageMetadata.version;
