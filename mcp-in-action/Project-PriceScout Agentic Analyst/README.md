# PriceScout: The AI-Powered Competitor Analyst

## Project Introduction

For this project, you're a Senior Strategy Analyst at a new, fast-growing AI company. Your company builds infrastructure for developers to run large language models, and you're in a market with tons of competition. Everyone is changing their prices, adding new models, and updating features every week.

### The Problem You Face

Right now, you spend more than half your week manually checking competitor websites. You have a spreadsheet open, and you're bouncing between tabs, copying and pasting pricing for models like 'Llama 3' or 'Deepseek v3' from different sites. It's slow, it's tedious, and by the time you finish your report, the data is already old. Your team can't make fast, smart decisions about your own pricing and product strategy because you're always playing catch-up.

### Your Mission: Build an Automated Intelligence Bot

Your goal is to build a tool that does this work for you. We're going to create a chatbot that you can simply ask questions to, like:

- "How much does DeepInfra charge for Deepseek v3?"
- "Go find the pricing for Groq."
- "Compare the prices for CloudRift AI and DeepInfra."

Behind the scenes, this bot will use AI to understand your question, use tools to browse the web, scrape the relevant data, and store it in a database for future use.

### How You'll Build It with MCP

This is where the Model Context Protocol (MCP) becomes so useful. Instead of building one giant, complicated application, you're going to use MCP to connect several small, specialized "agents" or servers.

- **The LLM Client:** This is our "manager" agent. We'll use the Anthropic Claude model. Its job is to understand our natural language questions and decide which tools to use.
- **The Scraper Server:** This is our "web researcher." We will build this custom MCP server ourselves using Python. Its job is to take a URL, use the Firecrawl service to scrape its content, and save that data.
- **The Database Server:** This is our "memory." We'll use a pre-built MCP server for SQLite. Its job is to store the data our scraper finds so we can ask questions about it later without having to scrape the same site again.
- **The Filesystem Server:** A pre-built server (run with `npx`) that lets the client read and write local files. It also shows MCP is language-agnostic — your Python client talks to this Node.js server.

You're not just building a chatbot; you're building an entire system of agents that work together.

### Project Assessment

You'll submit your project and it will be graded by Udacity mentors using a Rubric you'll find on the following pages. Make sure to check the rubric as you complete your project and before you submit it.

## Tech Stack & Tools

### Tech Stack

| Layer | Tool | Version | Role in PriceScout |
|---|---|---|---|
| Language | Python | 3.11 (3.10+ required) | Client and scraper server, written with `asyncio` |
| LLM | Anthropic Claude (`claude-sonnet-4-5-20250929`) | `anthropic` 2.3.0 | Understands queries, picks tools, and extracts structured pricing data |
| Protocol | Model Context Protocol (MCP) | `mcp` 1.30.0 | Connects the client to the three servers over stdio |
| Scraper server | FastMCP (from `mcp`) + Firecrawl | `firecrawl-py` 4.54.0 | Custom server in `starter_server.py` exposing `scrape_websites` and `extract_scraped_info` |
| Database server | `mcp-server-sqlite` (pre-built) | 2025.4.25 | Stores extracted plans in the `pricing_plans` table of `test.db` |
| Filesystem server | `@modelcontextprotocol/server-filesystem` (pre-built, Node.js) | 2.1.0 | Lets Claude read and write files in the project folder |
| Runtime for filesystem server | Node.js / `npx` | 24.x | Runs the filesystem server |
| Package manager | `uv` / `uvx` | 0.9.2 | Creates the venv, installs `pyproject.toml` deps, runs the SQLite server |
| Secrets | `python-dotenv` | 1.2.4 | Loads API keys from `.env` |
| API gateway | Vocareum | — | Proxies Anthropic requests for `voc-` keys (`ANTHROPIC_BASE_URL`) |

### Architecture

```
                 ┌───────────────────────────────┐
  You ──query──► │ starter_client.py (MCP client)│ ◄──► Anthropic Claude (via Vocareum)
                 └──────┬───────────┬────────────┘
                   MCP  │      MCP  │       MCP
          ┌─────────────┘           │          └──────────────┐
          ▼                         ▼                         ▼
 llm_inference server        sqlite server            filesystem server
 (starter_server.py)         (mcp-server-sqlite)      (server-filesystem, npx)
   │                           │
   ▼                           ▼
 Firecrawl API ──► scraped_content/       test.db → pricing_plans
                   *_markdown.txt, *_html.txt,
                   scraped_metadata.json
```

### How a Query Flows

1. `ChatSession.start` launches all servers in `server_config.json`, collects their tools, and creates the `pricing_plans` table.
2. `process_query` sends your question and the full tool list to Claude.
3. When Claude asks for a tool, the client finds the server that owns it, calls it through `Server.execute_tool` (60 s timeout, retries), and sends the result back to Claude. This repeats until Claude answers with plain text.
4. `DataExtractor` asks Claude to turn that answer into JSON pricing plans and inserts each plan into SQLite.
5. Typing `show data` prints the five most recent rows from `pricing_plans`.

### MCP Tools

| Server | Tools |
|---|---|
| `llm_inference` (custom) | `scrape_websites`, `extract_scraped_info` |
| `sqlite` | `read_query`, `write_query`, `create_table`, `list_tables`, `describe_table`, `append_insight` |
| `filesystem` | `read_file`, `read_text_file`, `read_media_file`, `read_multiple_files`, `write_file`, `edit_file`, `create_directory`, `list_directory`, `list_directory_with_sizes`, `directory_tree`, `move_file`, `search_files`, `get_file_info`, `list_allowed_directories` |

### Project Files

| File | Purpose |
|---|---|
| `starter_client.py` | MCP client and chatbot: config loading, server connections, tool-use loop, data extraction, `show data` |
| `starter_server.py` | Custom FastMCP scraper server backed by Firecrawl |
| `server_config.json` | Which MCP servers to launch and how |
| `pyproject.toml` / `uv.lock` | Python dependencies managed by `uv` |
| `.env` | API keys (not committed; listed in `.gitignore`) |
| `scraped_content/` | Created at runtime: scraped pages plus `scraped_metadata.json` |
| `test.db` | Created at runtime: SQLite database with `pricing_plans` |

### Implementation Notes

These are places where the finished code differs from the step-by-step instructions, and why:

- **Firecrawl success check:** `firecrawl-py` 4.x returns a `Document` without a `success` field and raises an exception when a scrape fails. The scraper still checks `success` if present, but otherwise treats any returned content as a successful scrape. Failures are recorded in `scraped_metadata.json` with an `error` field.
- **SQLite server pin:** `uvx mcp-server-sqlite` installs the newest `mcp` (2.x), which removed an API the server needs, so it crashes on startup. `server_config.json` runs it with `--with "mcp<2"`.
- **SQL quoting:** values are escaped (`'` → `''`) before being inserted, so names or text containing apostrophes don't break the `INSERT`.
- **`show data` parsing:** the instructions' snippet uses `pricing.content[0]["text"]`, but MCP returns objects, so the code uses `.text`. If the result isn't valid JSON, it falls back to `ast.literal_eval`.
- **Vocareum keys:** keys starting with `voc-` need `ANTHROPIC_BASE_URL=https://claude.vocareum.com` in `.env`. The Anthropic SDK reads it automatically.
- **System prompt (saves API credits):** without guidance, Claude re-scraped before every question, and for the comparison it scraped the providers' homepages, which overwrote the saved pricing pages under the same provider name. `SYSTEM_PROMPT` in `starter_client.py` tells Claude to check saved data first and to scrape only the exact pricing URL it was given. This follows the instructions' note about reading saved data instead of scraping again.
- **Model:** `claude-sonnet-4-5-20250929` is the model the instructions require. Anthropic has announced it will be retired on November 30, 2026.

## Technical Environment

Let's walk through the technical environment you'll be using for this project.

### 1. The Core Protocol: MCP (Model Context Protocol)

This is the most important concept in the project. MCP is the set of rules—the "protocol"—that allows our different pieces of software to talk to each other. It's like the common language our "agents" use.

**Why we're using it:** Instead of building one giant, complex app, we're building a system of small, independent "servers." MCP is the protocol that lets our main client discover and give commands to the server and our database.

### 2. The Main Application: Python & Asyncio

The entire project is written in Python. You'll specifically be using modern Python (3.10+) for asynchronous programming.

### 3. The Client

This is the heart of our application and acts as the "orchestrator."

- **Anthropic API:** This is our LLM, our "brain." We use the `anthropic` Python library to send our user's query to a Claude model. The model's job is to understand the text and decide if it needs to use a tool.
- **`mcp` (Client Library):** We use the `mcp` library to manage all our server connections. It handles the low-level work of connecting to the servers listed in `server_config.json`, sending the tool-call commands, and getting the results back.
- **`dotenv`:** A simple but handy library for loading our API keys (like `ANTHROPIC_API_KEY`) from the `.env` file. This keeps our secret keys out of the main code.

### 4. The "Specialists": The MCP Servers

These are our independent workers.

- **The Custom Scraper:**
  - **FastMCP:** This is a helper from the `mcp` library that makes it very easy to turn our Python functions into an MCP server.
  - **Firecrawl:** This is the third-party scraping service. You'll use the `firecrawl-py` library to send a URL to it and get back clean Markdown or HTML. This saves us from having to write a complex web scraper ourselves.
- **The SQLite Server (Pre-built):** You are using a pre-built MCP server for SQLite.
- **The Filesystem Server (Pre-built):** This is another pre-built server, this one run using `npx` (from the Node.js world). This shows that MCP is language-agnostic. Our Python client can easily talk to this Node.js server to read or write files.

### 5. The Environment Manager: uv

The project uses `uv` instead of `pip` or `conda`.

**uv:** This is a new, extremely fast Python package manager. It does the job of `pip` (installing packages) and `venv` (creating virtual environments). The `uv sync` command reads our `pyproject.toml` file and installs exactly the packages we need, making our setup quick and reproducible.

### Summary

To summarize, the environment is:

- A "manager" (`client.py`) that uses an LLM (`anthropic`) to make decisions.
- A "language" (MCP) that lets the manager talk to its workers.
- A team of "workers" (MCP servers) that perform special tasks: one custom Python server (`server.py`) for scraping and two pre-built servers for databases and files.
- All of it is built in Python using modern `asyncio` and managed by a fast packager called `uv`.

## Workspace Instructions

- On the following pages, you'll find a workspace with all of the necessary tooling already installed.
- The workspace on the following page contains the starter code for the project.
- If you click on the "Cloud Resources" tab above, you'll find an Anthropic API key for you to use in your project. This key has a $5.00 budget, so use it wisely; there is no need to use expensive reasoning models in this project.

## Local Machine Instructions

If you prefer to work locally instead of in the provided online workspace, here is a complete guide to getting your environment set up.

### Step 1: Get the Project Files

First, download the project files (including `starter_server.py`, `starter_client.py`, `pyproject.toml`, `server_config.json`, etc.) to a folder on your computer.

### Step 2: Install Prerequisite Tools

You'll need three main tools installed on your system:

- **Python (version 3.10 or newer):** This project requires Python 3.10 or higher. You can download it from [python.org](https://www.python.org/).
- **uv (the Python packager):** We use `uv` to manage our Python packages. It's incredibly fast. You can install it by following the instructions at [astral.sh/uv](https://astral.sh/uv). A common command is:

  ```bash
  # For macOS, Linux, or WSL
  curl -LfsS https://astral.sh/uv/install.sh | sh
  ```

- **Node.js (for `npx`):** One of our MCP servers (the filesystem server) is run using `npx`, which comes with Node.js. You can download it from [nodejs.org](https://nodejs.org/).

### Step 3: Create Your Virtual Environment

Once the tools are installed, open your terminal (like Terminal, PowerShell, or Command Prompt) and navigate into your project folder:

```bash
cd path/to/your/mcp-project
```

Now, let's create a Python virtual environment using `uv`:

```bash
# This creates a new virtual environment in a folder named .venv
uv venv
```

### Step 4: Activate and Sync Your Environment

Next, you need to "activate" this environment. This tells your terminal to use this specific environment's Python and packages.

```bash
# On macOS or Linux
source .venv/bin/activate
```

```powershell
# On Windows (PowerShell)
.venv\Scripts\Activate.ps1
```

With your environment active, install all the project dependencies from the `pyproject.toml` file with a single command:

```bash
# This reads pyproject.toml and installs everything
uv sync
```

### Step 5: Set Up Your API Keys

The project needs API keys for Anthropic (our LLM) and Firecrawl (our scraper). The code in the starter files is set up to read these from a `.env` file.

1. Create a new file in your project folder named `.env`.
2. Open this file in your code editor and add your keys, like this:

   ```
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
   FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxx
   ```

### Step 6: Update Your Server Configuration (Important!)

This is a small but critical step. The `starter_client.py` file uses `server_config.json` to know how to start the other MCP servers. The default path for your scraper server is set for the online workspace. You need to update it for your local machine.

1. Open `server_config.json`.
2. Find the `"llm_inference"` server.
3. Change the `"args"` list to point to your `starter_server.py` file. The original path is `"mcp-project/server.py"`, but since your file is in the same folder, you can just use its name.

Find this block:

```json
"llm_inference": {
    "command": "uv",
    "args": ["run", "mcp-project/server.py"]
},
```

And change it to this (to match the file you're editing):

```json
"llm_inference": {
    "command": "uv",
    "args": ["run", "starter_server.py"]
},
```

### Step 7: You're Ready to Go!

That's it! Your local environment is fully configured. You can now complete the tasks in `starter_server.py` and `starter_client.py` and run your project locally by executing the client file from your activated terminal:

```bash
python starter_client.py
```

## Project Rubric

On the following pages, you'll find the rubric that will be used to assess your project. Please check the rubric while completing the project, and before submission.

## Project Starter Files

If working locally, you can download the starter files from the workspace on the following page. Just select the files and right click, choose "download file".

## Getting a Firecrawl API Key

To complete the project, your scraper server needs to talk to the Firecrawl service. This requires a free API key.

1. **Go to the Sign-up Page:** Use this link to create a new, free account: [https://www.firecrawl.dev/signin](https://www.firecrawl.dev/signin). You can sign up quickly using a Google, GitHub, or email account.
2. **Find Your API Key:** Once you have signed in, you will be on your dashboard. On the left-hand menu, click on the "API Keys" section. You will see your first API key already created for you, labeled "Default".
3. **Copy Your Key:** Copy the API key (it will be a long string that starts with `fc-...`).
4. **Add the Key to Your Project:** Open the `.env` file in your project folder. Paste your Firecrawl API key directly after `FIRECRAWL_API_KEY=`. Your `.env` file should look like this (but with your real keys):

   ```
   FIRECRAWL_API_KEY=fc-your-firecrawl-key-goes-here
   ```

That's it! Once your key is in the `.env` file, your `starter_server.py` will be able to connect to Firecrawl and scrape the websites.

## Project Instructions

Here are the step-by-step instructions to guide you through completing this project. We'll build the server's tools first, then wire up the client to use them.

### Step 0: Prerequisites (Your Environment)

Before you write any code, let's make sure your environment is ready.

1. **Set API Keys:** Create a new file in the root of your project folder named `.env`. This file is used to store your secret API keys. Open it and add your keys from Anthropic and Firecrawl:

   ```
   ANTHROPIC_API_KEY=your-anthropic-key-goes-here
   FIRECRAWL_API_KEY=your-firecrawl-key-goes-here
   ```

2. **Configure Your Server Path:** Open the `server_config.json` file. We need to tell the client how to find and run your `starter_server.py` file. Find the `"llm_inference"` server configuration:

   ```json
   "llm_inference": {
       "command": "uv",
       "args": ["run", "mcp-project/server.py"]
   },
   ```

   Change the `"args"` to point to the `starter_server.py` file you will be editing:

   ```json
   "llm_inference": {
       "command": "uv",
       "args": ["run", "starter_server.py"]
   },
   ```

### Step 1: Build Your Scraper Server (`starter_server.py`)

Open `starter_server.py`. This file will become your custom MCP server that scrapes websites. We need to complete the two functions marked as tools.

#### Task 1.1: Complete the `scrape_websites` tool

This function will use Firecrawl to scrape a list of websites, save their content to files, and update a central `scraped_metadata.json` file.

Inside the `scrape_websites` function, replace the `# continue your solution here ...` comment with logic to do the following:

1. **Load Existing Metadata:** Try to open and load `scraped_metadata.json`. If it doesn't exist or is empty, initialize `scraped_metadata` as an empty dictionary `{}`.
2. **Initialize:** Create a list called `successful_scrapes` to hold the names of providers we successfully scrape.
3. **Loop Through Websites:** Iterate over the `websites` dictionary (which contains `provider_name -> url` pairs).
4. **Inside the Loop (for each website):**
   - Wrap the scraping logic in a `try...except` block to handle any errors.
   - Log that you are starting to scrape (e.g., `logger.info(f"Scraping {provider_name}: {url}")`).
   - Call Firecrawl: `scrape_result = app.scrape(url, formats=formats).model_dump()`.
   - Create a `metadata` dictionary for this provider, including its name, URL, domain, and scrape time.
   - **If Successful:** Check if `scrape_result.get('success', False)` is true.
     - **Save Content:** Loop through the `formats` (e.g., `'markdown'`, `'html'`). For each format, get the content from `scrape_result`, create a filename (like `f"{provider_name}_{format_type}.txt"`), and write the content to a file in the `SCRAPE_DIR`.
     - **Update Metadata:** Add the filenames to your `metadata` dictionary (under a `content_files` key). Add the page `title` and `description` from the scrape result.
     - Add the `provider_name` to your `successful_scrapes` list.
   - **If Failed:** Log the error from `scrape_result`.
   - **Finally:** Add your `metadata` dictionary to the main `scraped_metadata` dictionary (e.g., `scraped_metadata[provider_name] = metadata`).
5. **After the Loop:**
   - Write the entire `scraped_metadata` dictionary back to the `scraped_metadata.json` file.
   - Log the final results.
   - Return the `successful_scrapes` list.

#### Task 1.2: Complete the `extract_scraped_info` tool

This function will read the data you just saved.

Inside the `extract_scraped_info` function, replace the `# contine your response here ...` comment with logic to do the following:

1. **Load Metadata:** Open and load the `scraped_metadata.json` file inside a `try...except` block.
2. **Find a Match:** Loop through the `scraped_metadata` dictionary. For each `provider_name` and `metadata` entry, check if your `identifier` matches any of these:
   - The `provider_name`
   - The `metadata.get('url', '')`
   - The `metadata.get('domain', '')`
3. **If a Match is Found:**
   - Make a copy of the metadata (e.g., `result = metadata.copy()`).
   - Check if the metadata has `'content_files'`. If it does, create a new `result['content']` dictionary.
   - Loop through the `content_files` (e.g., `format_type`, `filename`).
   - Read the content from the file (e.g., `os.path.join(SCRAPE_DIR, filename)`) and store it in `result['content'][format_type]`.
   - Return the `result` dictionary as a formatted JSON string: `return json.dumps(result, indent=2)`.
4. **If No Match/Error:** If the loop finishes with no match or if you hit an error (like `FileNotFoundError`), return a string message like `f"There's no saved information related to identifier '{identifier}'."`.

### Step 2: Build Your Client Application (`starter_client.py`)

Open `starter_client.py`. This is your "manager" app that will talk to your server. We just need to fill in the sections marked `# complete`.

#### In `Configuration.load_config`

- Implement the logic to open and read the `file_path`.
- Load the JSON: `config = json.load(f)`.
- Add error handling (the `try...except` block is provided).
- Check if `mcpServers` is in the config: `if "mcpServers" not in config: ...`
- Return the `config`.

#### In `Server.initialize`

The `server_params` object is empty. Fill it using the `self.config` dictionary:

```python
server_params = StdioServerParameters(
    command=command,
    args=self.config["args"],
    env={**os.environ, **self.config["env"]} if self.config.get("env") else None,
)
```

#### In `Server.list_tools`

- Check if the session exists: `if not self.session: ...`
- Call the session to get tools: `tools_response = await self.session.list_tools()`.
- Format the response. The starter code provides the loop; you just need to populate the `tool_def` dictionary:

```python
tool_def: ToolDefinition = {
    "name": tool.name,
    "description": tool.description,
    "input_schema": tool.inputSchema
}
```

#### In `Server.execute_tool`

Implement the retry loop. The core of the `try` block is:

```python
logging.info(f"Executing {tool_name}...")
result = await self.session.call_tool(name=tool_name, arguments=arguments, read_timeout_seconds=timedelta(seconds=60))
return result
```

#### In `DataExtractor.extract_and_store_data`

After loading the `pricing_data`, loop through the plans. Inside the `for plan in pricing_data.get("plans", []):` loop, add the `sqlite_server.execute_tool` call to insert the data into the database:

```python
await self.sqlite_server.execute_tool("write_query", {
    "query": f"""
    INSERT INTO pricing_plans (company_name, plan_name, input_tokens, output_tokens, currency, billing_period, features, limitations, source_query)
    VALUES (
        '{pricing_data.get("company_name", "Unknown")}',
        '{plan.get("plan_name", "Unknown Plan")}',
        '{plan.get("input_tokens", 0)}',
        '{plan.get("output_tokens", 0)}',
        '{plan.get("currency", "USD")}',
        '{plan.get("billing_period", "unknown")}',
        '{json.dumps(plan.get("features", []))}',
        '{plan.get("limitations", "")}',
        '{user_query}')
    """
})
```

#### In `ChatSession.process_query`

- **Model Name:** Change `<ENTER_MODEL_NAME>` to a Vocareum-available model. Use the same dated model the solution uses: `'claude-sonnet-4-5-20250929'`.
- **`if content.type == 'text':` block:**
  - Add the text to the `full_response`: `full_response += content.text + "\n"`.
  - Add the content to the assistant's message: `assistant_content.append(content)`.
  - Check if this is the only content. If so, the model is done:

    ```python
    if len(response.content) == 1:
        process_query = False
    ```

- **`elif content.type == 'tool_use':` block:** This is the full tool-use loop. The logic is:
  1. Append the tool use request to `assistant_content` and then to `messages`.
  2. Get the tool `id`, `args`, and `name` from the `content`.
  3. Find the server that has this tool.
  4. `execute_tool` on that server.
  5. Append the `tool_result` to `messages`.
  6. Call `self.anthropic.messages.create` again with the new `messages` list.
  7. Check if the new response is just text, and if so, stop the loop.

#### In `ChatSession.show_stored_data`

Add the tool call to read from the `pricing_plans` table:

```python
pricing = await self.sqlite_server.execute_tool("read_query", {
    "query": "SELECT company_name, plan_name, input_tokens, output_tokens, currency FROM pricing_plans ORDER BY created_at DESC LIMIT 5"
})

print("\nRecently Stored Data:")
print("=" * 50)

print("\nPricing Plans:")
# result.content[0].text is a JSON string of rows — parse it first.
import json
rows = json.loads(pricing.content[0].text)
for plan in rows:
    print(f"  • {plan['company_name']}: {plan['plan_name']} - Input Token ${plan['input_tokens']}, Output Tokens ${plan['output_tokens']}")

print("=" * 50)
```

### Step 3: Run and Test Your Project

You are now ready to run your application!

1. **Run the Client:** In your terminal (with your virtual environment activated), run:

   ```bash
   python starter_client.py
   ```

2. **Test Your Tools:** Your client will start, connect to all 3 servers (your scraper, sqlite, and filesystem), and give you a `Query:` prompt.
3. **Use the Test Prompts from the README.md:**
   - First, scrape the sites:
     - "scrape these sites: {'cloudrift': 'https://www.cloudrift.ai/inference', 'deepinfra': 'https://deepinfra.com/pricing', 'fireworks': 'https://fireworks.ai/pricing#serverless-pricing', 'groq': 'https://groq.com/pricing'}"
   - Then, ask questions about the scraped content:
     - "How much does cloudrift ai (https://www.cloudrift.ai/inference) charge for deepseek v3?"
     - "How much does deepinfra (https://deepinfra.com/pricing) charge for deepseek v3"
     - "Compare cloudrift ai and deepinfra's costs for deepseek v3"
4. **Check your database:** Type `show data` to see the structured data your `DataExtractor` saved to the SQLite database.

> **Note:** One suggestion would be to read the data from the SQLite database at the time of comparing the costs of Cloudrift AI and DeepInfra, and then execute the comparison prompt on the retrieved data. Otherwise, the scraper will read the data again, which may result in additional API credit consumption.

## Instructions

In this project, you are going to make a chatbot to scrape LLM Inference Serving websites to research costs of serving various LLMs. You will do this by writing an MCP Server that hooks up to Firecrawl's API and saving the data in a SQLite Database. You should use the following websites to scrape:

- "cloudrift": "https://www.cloudrift.ai/inference"
- "deepinfra": "https://deepinfra.com/pricing"
- "fireworks": "https://fireworks.ai/pricing#serverless-pricing"
- "groq": "https://groq.com/pricing"

1. Make a venv with uv
2. Sync venv with pyproject.toml (`uv sync`)
3. Make an API Key on Anthropic and Firecrawl
4. Complete the 2 tool calls in `starter_server.py`
5. Change the `server_config.json` to point to your server file
6. Complete any section in `starter_client.py` that has "#complete".
7. Test using any methods taught in the course
8. Use the following prompts in your chatbot but play around with all the LLM providers in the list above: 
    - "How much does cloudrift ai (https://www.cloudrift.ai/inference) charge for deepseek v3?"
    - "How much does deepinfra (https://deepinfra.com/pricing) charge for deepseek v3"
    - "Compare cloudrift ai and deepinfra's costs for deepseek v3"

## Evidence

`evidence.pdf` (also in `screenshots/`) contains three terminal screenshots captured on 2026-10-29:

1. `1_scrape_query.png`: the `scrape these sites: {...}` query, the `scrape_websites` call, and the `Successfully scraped 4/4 websites` log.
2. `2_price_comparison.png`: the natural-language answer to "Compare cloudrift ai and deepinfra's costs for deepseek v3".
3. `3_show_data.png`: the `show data` output, limited to 5 rows by the `LIMIT 5` in `ChatSession.show_stored_data`.
