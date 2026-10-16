#!/usr/bin/env node
/**
 * indexnow — submit URLs to the IndexNow API.
 *
 * IndexNow is an open protocol for telling search engines immediately which
 * pages changed, instead of waiting for a crawl. It is supported by Bing,
 * Yandex, Seznam, Naver and (partially) by the crawlers that feed several AI
 * answer engines.
 *
 * Usage:
 *   node indexnow.mjs --host example.com --key-file ./key.txt
 *   node indexnow.mjs --host example.com --key abc123 --url https://example.com/a
 *   node indexnow.mjs --host example.com --key abc123 --no-sitemap --url https://example.com/new-post
 *
 * By default every <loc> in https://<host>/sitemap.xml is submitted, so the
 * tool can never advertise a URL the site does not actually serve.
 */
import fs from "node:fs";
import { parseArgs } from "node:util";

const ENDPOINT = "https://api.indexnow.org/indexnow";
/** IndexNow caps a single request at 10k URLs / 10 MB. */
const BATCH_SIZE = 10_000;

const USAGE = `indexnow — push URLs to the IndexNow API

  --host <name>        Site host, e.g. example.com. Required.
  --key <key>          IndexNow key (must be served at https://<host>/<key>.txt).
  --key-file <path>    Read the key from a file instead.
  --url <url>          Add a URL. Repeatable.
  --no-sitemap         Do not read sitemap.xml; submit only --url values.
  --dry                Print what would be sent, send nothing.
  --help               Show this message.

One of --key / --key-file is required. Exit code 0 on success.`;

const { values: opts } = parseArgs({
  options: {
    host: { type: "string" },
    key: { type: "string" },
    "key-file": { type: "string" },
    url: { type: "string", multiple: true, default: [] },
    "no-sitemap": { type: "boolean", default: false },
    dry: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (opts.help) {
  console.log(USAGE);
  process.exit(0);
}
if (!opts.host) {
  console.error("error: --host is required\n\n" + USAGE);
  process.exit(1);
}

const host = opts.host.replace(/^https?:\/\//, "").replace(/\/+$/, "");

let key = opts.key ?? "";
if (!key && opts["key-file"]) {
  key = fs.readFileSync(opts["key-file"], "utf8").trim();
}
if (!key) {
  console.error("error: provide --key or --key-file\n\n" + USAGE);
  process.exit(1);
}

const urls = [...opts.url];
if (!opts["no-sitemap"]) {
  const res = await fetch(`https://${host}/sitemap.xml`);
  if (!res.ok) {
    console.error(`error: sitemap fetch failed: ${res.status}`);
    process.exit(1);
  }
  const xml = await res.text();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(m[1].trim());
}

// Keep only well-formed URLs on this host — IndexNow rejects cross-host items
// and a single bad entry fails the whole batch.
const list = [...new Set(urls)].filter((u) => {
  try {
    return new URL(u).host === host;
  } catch {
    return false;
  }
});

if (list.length === 0) {
  console.error("error: no URLs to submit");
  process.exit(1);
}

const keyLocation = `https://${host}/${key}.txt`;
console.log(`${list.length} URL(s) for ${host}`);
console.log(`key: ${key.slice(0, 8)}… (served at ${keyLocation})`);

if (opts.dry) {
  for (const u of list.slice(0, 10)) console.log(`  would submit ${u}`);
  if (list.length > 10) console.log(`  …and ${list.length - 10} more`);
  process.exit(0);
}

for (let i = 0; i < list.length; i += BATCH_SIZE) {
  const batch = list.slice(i, i + BATCH_SIZE);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation, urlList: batch }),
  });
  // 200 = accepted; 202 = accepted, key pending verification.
  const ok = res.ok || res.status === 202;
  console.log(
    `batch ${Math.floor(i / BATCH_SIZE) + 1}: ${res.status} ${res.statusText}${
      ok ? "" : " <- failed"
    }`,
  );
  if (!ok) {
    console.error(await res.text());
    process.exit(1);
  }
}

console.log("done");
