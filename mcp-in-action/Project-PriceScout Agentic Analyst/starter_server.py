
import os
import json
import logging
from typing import List, Dict, Optional
from firecrawl import FirecrawlApp
from urllib.parse import urlparse
from datetime import datetime
from mcp.server.fastmcp import FastMCP

from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

SCRAPE_DIR = "scraped_content"

mcp = FastMCP("llm_inference")

@mcp.tool()
def scrape_websites(
    websites: Dict[str, str],
    formats: List[str] = ['markdown', 'html'],
    api_key: Optional[str] = None
) -> List[str]:
    """
    Scrape multiple websites using Firecrawl and store their content.
    
    Args:
        websites: Dictionary of provider_name -> URL mappings
        formats: List of formats to scrape ['markdown', 'html'] (default: both)
        api_key: Firecrawl API key (if None, expects environment variable)
        
    Returns:
        List of provider names for successfully scraped websites
    """
    
    if api_key is None:
        api_key = os.getenv('FIRECRAWL_API_KEY')
        if not api_key:
            raise ValueError("API key must be provided or set as FIRECRAWL_API_KEY environment variable")
    
    app = FirecrawlApp(api_key=api_key)
    
    path = os.path.join(SCRAPE_DIR)
    os.makedirs(path, exist_ok=True)
    
    # save the scraped content to files and then create scraped_metadata.json as a summary file
    # check if the provider has already been scraped and decide if you want to overwrite
    # {
    #     "cloudrift_ai": {
    #         "provider_name": "cloudrift_ai",
    #         "url": "https://www.cloudrift.ai/inference",
    #         "domain": "www.cloudrift.ai",
    #         "scraped_at": "2025-10-23T00:44:59.902569",
    #         "formats": [
    #             "markdown",
    #             "html"
    #         ],
    #         "success": "true",
    #         "content_files": {
    #             "markdown": "cloudrift_ai_markdown.txt",
    #             "html": "cloudrift_ai_html.txt"
    #         },
    #         "title": "AI Inference",
    #         "description": "Scraped content goes here"
    #     }
    # }
    metadata_file = os.path.join(path, "scraped_metadata.json")

    try:
        with open(metadata_file, "r") as f:
            scraped_metadata = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        scraped_metadata = {}

    successful_scrapes = []

    for provider_name, url in websites.items():
        metadata = {
            "provider_name": provider_name,
            "url": url,
            "domain": urlparse(url).netloc,
            "scraped_at": datetime.now().isoformat(),
            "formats": formats,
            "success": False,
        }
        try:
            logger.info(f"Scraping {provider_name}: {url}")
            scrape_result = app.scrape(url, formats=formats).model_dump()

            # firecrawl-py v4 raises on failure and has no 'success' flag,
            # so treat any returned content as a successful scrape
            success = scrape_result.get('success', any(scrape_result.get(fmt) for fmt in formats))

            if success:
                content_files = {}
                for format_type in formats:
                    content = scrape_result.get(format_type)
                    if content:
                        filename = f"{provider_name}_{format_type}.txt"
                        with open(os.path.join(path, filename), "w", encoding="utf-8") as f:
                            f.write(content)
                        content_files[format_type] = filename

                page_metadata = scrape_result.get('metadata') or {}
                metadata["success"] = True
                metadata["content_files"] = content_files
                metadata["title"] = page_metadata.get('title', '')
                metadata["description"] = page_metadata.get('description', '')
                successful_scrapes.append(provider_name)
            else:
                metadata["error"] = scrape_result.get('error', 'Unknown error')
                logger.error(f"Failed to scrape {provider_name}: {metadata['error']}")
        except Exception as e:
            metadata["error"] = str(e)
            logger.error(f"Error scraping {provider_name}: {e}")

        scraped_metadata[provider_name] = metadata

    with open(metadata_file, "w") as f:
        json.dump(scraped_metadata, f, indent=4)

    logger.info(f"Successfully scraped {len(successful_scrapes)}/{len(websites)} websites: {successful_scrapes}")
    return successful_scrapes

@mcp.tool()
def extract_scraped_info(identifier: str) -> str:
    """
    Extract information about a scraped website.
    
    Args:
        identifier: The provider name, full URL, or domain to look for
        
    Returns:
        Formatted JSON string with the scraped information
    """
    
    logger.info(f"Extracting information for identifier: {identifier}")

    metadata_file = os.path.join(SCRAPE_DIR, "scraped_metadata.json")
    logger.info(f"Checking metadata file: {metadata_file}")

    try:
        logger.info(f"Files in {SCRAPE_DIR}: {os.listdir(SCRAPE_DIR)}")
        with open(metadata_file, "r") as f:
            scraped_metadata = json.load(f)

        for provider_name, metadata in scraped_metadata.items():
            if identifier in (provider_name, metadata.get('url', ''), metadata.get('domain', '')):
                result = metadata.copy()
                if 'content_files' in metadata:
                    result['content'] = {}
                    for format_type, filename in metadata['content_files'].items():
                        with open(os.path.join(SCRAPE_DIR, filename), "r", encoding="utf-8") as f:
                            result['content'][format_type] = f.read()
                return json.dumps(result, indent=2)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.error(f"Error reading scraped info: {e}")

    return f"There's no saved information related to identifier '{identifier}'."

if __name__ == "__main__":
    mcp.run(transport="stdio")