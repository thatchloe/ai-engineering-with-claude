# CLAUDE.md

Context for Claude Code sessions on this project, written from the session of 2026-10-28/29 that completed it.

## Project

PriceScout: a Udacity MCP project. A chatbot (Claude) uses MCP servers to scrape LLM inference pricing pages with Firecrawl, store pages on disk, and save extracted pricing plans to SQLite. Graded against the Udacity rubric. `README.md` holds the full brief, setup guide, step-by-step instructions, and a "Tech Stack & Tools" section.

## Layout

- `starter_client.py`: MCP client and chat loop (`Configuration`, `Server`, `DataExtractor`, `ChatSession`). Has a `SYSTEM_PROMPT` constant.
- `starter_server.py`: FastMCP server `llm_inference` with tools `scrape_websites` and `extract_scraped_info`.
- `server_config.json`: launches `llm_inference` (`uv run starter_server.py`), `sqlite` (`uvx --with "mcp<2" mcp-server-sqlite --db-path ./test.db`), and `filesystem` (`npx @modelcontextprotocol/server-filesystem .`).
- `.env`: `ANTHROPIC_API_KEY` (Vocareum `voc-` key), `ANTHROPIC_BASE_URL=https://claude.vocareum.com`, `FIRECRAWL_API_KEY`. Git-ignored via `.gitignore`. Never print or commit it.
- `evidence.pdf` and `screenshots/`: rubric evidence (scrape 4/4, comparison answer, `show data` with 5 rows), rendered from a real pty transcript on 2026-10-29 after the first review asked for it.
- Runtime output: `scraped_content/` (`<provider>_markdown.txt`, `<provider>_html.txt`, `scraped_metadata.json`) and `test.db` (`pricing_plans` table).

## Running

```bash
source .venv/bin/activate
python starter_client.py
```

Type queries at `Query:`, `show data` for recent DB rows, `quit` to exit. Non-interactive testing: pipe lines in, e.g. `printf "question\nshow data\nquit\n" | .venv/bin/python starter_client.py`.

## Decisions and gotchas

- **Model:** `claude-sonnet-4-5-20250929` is required by the instructions (Vocareum). It is deprecated and retires 2026-11-30; don't change it unless the user asks.
- **Vocareum:** `voc-` keys only work with `ANTHROPIC_BASE_URL=https://claude.vocareum.com`. The SDK reads it from the environment, so no code change is needed. Budget is $5; the session's testing used about $1–1.50.
- **Firecrawl 4.x:** `app.scrape(...)` returns a `Document` with no `success` field and raises on failure. The scraper uses `success` if present, otherwise treats returned content as success, and records failures with an `error` field in metadata.
- **SQLite server pin:** `uvx mcp-server-sqlite` pulls `mcp` 2.x, which crashes it (`'Server' object has no attribute 'list_resources'`). Keep the `--with "mcp<2"` pin.
- **SQL inserts:** values are escaped (`'` → `''`) via a local `sql()` helper in `extract_and_store_data`.
- **`show_stored_data`:** uses `pricing.content[0].text` (the instructions' `["text"]` is wrong) and falls back to `ast.literal_eval` if the result isn't JSON.
- **System prompt:** added because Claude re-scraped before every question and once scraped homepages, overwriting the pricing-page data under the same provider name. It tells Claude to call `extract_scraped_info` first and scrape only exact pricing URLs.
- **Python env:** `python-dotenv` is installed transitively (not listed in `pyproject.toml`). `uv sync` installed Python 3.11.5 in `.venv`.

## Test results (2026-10-29)

- All 4 sites scraped successfully: cloudrift (`https://www.cloudrift.ai/inference`), deepinfra (`https://deepinfra.com/pricing`), fireworks (`https://fireworks.ai/pricing#serverless-pricing`), groq (`https://groq.com/pricing`).
- CloudRift no longer lists DeepSeek V3; it offers DeepSeek-V4-Flash-0731 at $0.14 in / $0.28 out per 1M tokens.
- DeepInfra DeepSeek-V3: $0.32 in / $0.89 out per 1M tokens (also V3.1 $0.25/$0.95, V3.2 $0.26/$0.38, V4-Flash-0731 $0.06/$0.18).
- `test.db` holds 8 verified rows.

## Known limitations

- `DataExtractor` expects one company per answer, so comparison answers store 0 plans.
- Groq's pricing page scrapes as marketing text with no prices.
- `extract_scraped_info` returns markdown and HTML; DeepInfra's HTML is ~256 KB, so a DeepInfra question costs about $0.30. Scraping markdown only would cut this.

## User preferences

- Keep edits scoped to what was asked.
- No Claude co-author trailers on commits.
