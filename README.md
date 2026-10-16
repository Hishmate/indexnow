# indexnow

Submit URLs to the [IndexNow](https://www.indexnow.org/) API from the command line.

IndexNow is an open protocol for telling search engines which pages changed,
instead of waiting for the next crawl. It is supported by Bing, Yandex, Seznam
and Naver, and by several of the crawlers that feed AI answer engines.

## Why

Most sites have a `sitemap.xml` and assume that is enough. A sitemap is only a
hint — a crawler may not read it for days. IndexNow is a push: you submit a URL
and the engine fetches it. For a new site this is the difference between
"indexed this week" and "indexed when the crawler gets around to it".

## Install

No dependencies, no build step. Node 18 or newer (uses global `fetch`).

```bash
git clone https://github.com/Hishmate/indexnow.git && cd indexnow
chmod +x indexnow.mjs
```

## Get a key

Generate any 8–128 character hex string (`a–f`, `0–9`) and serve it as a plain
text file at the root of your site:

```
https://example.com/<key>.txt   ->   <key>
```

Keep the key secret-ish but remember anyone who reads that file can submit as
you. Rotating it is fine.

## Usage

```bash
# Submit every URL in https://example.com/sitemap.xml
node indexnow.mjs --host example.com --key-file ./key.txt

# Submit one page
node indexnow.mjs --host example.com --key abc123 \
  --no-sitemap --url https://example.com/blog/new-post

# See what would be sent
node indexnow.mjs --host example.com --key abc123 --dry
```

### Options

| Flag | Meaning |
| --- | --- |
| `--host <name>` | Site host, e.g. `example.com`. **Required.** |
| `--key <key>` | The IndexNow key. |
| `--key-file <path>` | Read the key from a file. |
| `--url <url>` | Add a URL. Repeatable. |
| `--no-sitemap` | Skip `sitemap.xml`; submit only `--url` values. |
| `--dry` | Print what would be sent, send nothing. |
| `--help` | Usage. |

One of `--key` / `--key-file` is required. Exit code `0` on success.

## Behaviour worth knowing

- **Reads the live sitemap by default**, so it cannot submit a URL your site
  does not actually serve.
- **Filters to the same host.** IndexNow rejects cross-host entries and one bad
  URL fails the entire batch.
- **Batches at 10,000 URLs** per request, the documented cap.
- **Accepts both 200 and 202** as success — 202 means the key is still being
  verified, which is normal on first use.

## Automating it

Wire it into a deploy so new pages get pushed on every release:

```yaml
- run: node indexnow.mjs --host example.com --key-file ./key.txt
```

## License

MIT — see [LICENSE](./LICENSE).
