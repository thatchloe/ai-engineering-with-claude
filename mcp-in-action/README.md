# MCP in Action

Second course of the **AI Engineering with Claude** program. It covers the Model Context Protocol: writing a custom MCP server, wiring pre-built servers (SQLite, filesystem) into one client, and letting Claude drive the tools through a complete tool-use loop.

## Project

### [PriceScout: Agentic Analyst](Project-PriceScout%20Agentic%20Analyst/)

An MCP-powered pricing analyst. A Claude-driven client connects to three MCP servers: a custom Python server that scrapes LLM inference pricing pages with Firecrawl, the SQLite server that stores extracted pricing plans, and the filesystem server. Ask it natural-language questions such as "Compare cloudrift ai and deepinfra's costs for deepseek v3" and it scrapes, stores, and answers.

- `starter_server.py`: FastMCP server with `scrape_websites` and `extract_scraped_info`.
- `starter_client.py`: MCP client, Claude tool-use loop, `DataExtractor`, and `show data` from SQLite.
- `evidence.pdf` / `screenshots/`: rubric evidence (scrape 4/4, comparison answer, `show data` with 5 rows).
- `README.md`: full project brief, setup, and rubric notes.
