import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.join(projectRoot, "render-site");
const apiBaseUrl = process.env.API_BASE_URL?.trim().replace(/\/+$/, "");

if (!apiBaseUrl) {
  throw new Error("Set API_BASE_URL to the deployed Render API URL before building the storefront.");
}

let parsedApiUrl;
try {
  parsedApiUrl = new URL(apiBaseUrl);
} catch {
  throw new Error("API_BASE_URL must be a valid absolute URL.");
}
if (
  parsedApiUrl.protocol !== "https:" &&
  !(parsedApiUrl.protocol === "http:" && parsedApiUrl.hostname === "localhost")
) {
  throw new Error("API_BASE_URL must use HTTPS outside localhost.");
}
if (parsedApiUrl.username || parsedApiUrl.password || parsedApiUrl.pathname !== "/" || parsedApiUrl.search || parsedApiUrl.hash) {
  throw new Error("API_BASE_URL must be the API origin without credentials, a path, query, or fragment.");
}

const frontendFiles = [
  "account.css",
  "account.html",
  "account.js",
  "app.js",
  "brand.css",
  "gcash-qr.jpg",
  "index.html",
  "shop.html",
  "styles.css"
];

await mkdir(outputDirectory, { recursive: true });
for (const file of frontendFiles) {
  await copyFile(path.join(projectRoot, file), path.join(outputDirectory, file));
}

const configPath = path.join(projectRoot, "supabase-config.js");
const config = await readFile(configPath, "utf8");
const apiConfigPattern = /apiBaseUrl:\s*"[^"]*"/;
if (!apiConfigPattern.test(config)) {
  throw new Error("Could not find apiBaseUrl in supabase-config.js.");
}
await writeFile(
  path.join(outputDirectory, "supabase-config.js"),
  config.replace(apiConfigPattern, `apiBaseUrl: ${JSON.stringify(parsedApiUrl.origin)}`)
);
