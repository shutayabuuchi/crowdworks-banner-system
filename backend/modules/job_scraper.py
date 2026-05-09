from __future__ import annotations
import time
import uuid
import re
import requests
from bs4 import BeautifulSoup
from backend.config import CROWDWORKS_SEARCH_URL, BANNER_CATEGORY_PARAMS, SCRAPE_INTERVAL_SECONDS
from backend.db.supabase_client import save_job, get_job

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; BannerSystemBot/1.0; educational purposes)",
    "Accept-Language": "ja-JP,ja;q=0.9",
}

BANNER_KEYWORDS = [
    "バナー", "banner", "ロゴ", "logo", "イラスト", "チラシ", "フライヤー",
    "デザイン", "サムネ", "キャラクター", "アイコン"
]


def is_banner_job(title: str, description: str) -> bool:
    text = (title + " " + description).lower()
    return any(kw.lower() in text for kw in BANNER_KEYWORDS)


def extract_job_id_from_url(url: str) -> str:
    match = re.search(r'/jobs/(\d+)', url)
    return f"CW{match.group(1)}" if match else str(uuid.uuid4())[:8]


def scrape_job_list(page: int = 1) -> list:
    """Scrape one page of job listings from Crowdworks."""
    params = {**BANNER_CATEGORY_PARAMS, "page": page}
    try:
        resp = requests.get(CROWDWORKS_SEARCH_URL, params=params, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"[Scraper] Failed to fetch job list page {page}: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    jobs = []

    # Crowdworks job cards - selectors may need adjustment if site changes
    job_cards = soup.select("li.job_item, article.job-item, .job_list_item, li[class*='job']")
    if not job_cards:
        # Fallback: find any links to /public/jobs/
        job_links = soup.select("a[href*='/public/jobs/']")
        job_cards = list({a['href']: a for a in job_links}.values())

    for card in job_cards[:20]:  # limit per page
        try:
            if hasattr(card, 'get') and card.get('href'):
                href = card['href']
                title_el = card
            else:
                link = card.select_one("a[href*='/public/jobs/']")
                if not link:
                    continue
                href = link.get('href', '')
                title_el = link

            if not href.startswith('http'):
                href = "https://crowdworks.jp" + href

            job_id = extract_job_id_from_url(href)
            title = title_el.get_text(strip=True)[:200] if title_el else "Unknown"

            reward_el = card.select_one(".reward, .price, [class*='reward'], [class*='price']") if hasattr(card, 'select_one') else None
            reward = reward_el.get_text(strip=True) if reward_el else "要確認"

            deadline_el = card.select_one(".deadline, [class*='deadline'], time") if hasattr(card, 'select_one') else None
            deadline = deadline_el.get_text(strip=True) if deadline_el else None

            jobs.append({
                "job_id": job_id,
                "url": href,
                "title": title,
                "reward": reward,
                "deadline": deadline,
                "client_name": None,
                "description": "",
                "requirements": [],
                "attachments": [],
                "processed": False,
            })
        except Exception as e:
            print(f"[Scraper] Error parsing job card: {e}")
            continue

    return jobs


def scrape_job_detail(job: dict) -> dict:
    """Fetch and parse the detail page of a job."""
    time.sleep(SCRAPE_INTERVAL_SECONDS)
    try:
        resp = requests.get(job["url"], headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"[Scraper] Failed to fetch job detail {job['url']}: {e}")
        return job

    soup = BeautifulSoup(resp.text, "html.parser")

    # Extract description
    desc_el = soup.select_one(".job_description, .description, [class*='description'], #job_description")
    if desc_el:
        job["description"] = desc_el.get_text(separator="\n", strip=True)[:3000]

    # Extract client name
    client_el = soup.select_one(".client_name, .employer, [class*='client']")
    if client_el:
        job["client_name"] = client_el.get_text(strip=True)[:100]

    # Extract title if not already set
    title_el = soup.select_one("h1, .job_title, [class*='title']")
    if title_el and job["title"] in ("Unknown", ""):
        job["title"] = title_el.get_text(strip=True)[:200]

    # Extract attachments
    attachments = []
    for link in soup.select("a[href]"):
        href = link.get("href", "")
        if any(ext in href.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip']):
            file_name = href.split("/")[-1]
            if not href.startswith("http"):
                href = "https://crowdworks.jp" + href
            mime = "image/jpeg" if any(ext in href.lower() for ext in ['.jpg', '.jpeg']) else \
                   "image/png" if ".png" in href.lower() else \
                   "application/pdf" if ".pdf" in href.lower() else "application/octet-stream"
            attachments.append({"file_name": file_name, "file_url": href, "file_type": mime, "local_path": None})

    job["attachments"] = attachments[:10]
    return job


def run_scraper() -> dict:
    """Main scraper entry point. Scrape new banner jobs and save to DB."""
    print("[Scraper] Starting job scrape...")
    new_count = 0
    skip_count = 0

    for page in range(1, 4):  # scrape up to 3 pages
        jobs = scrape_job_list(page)
        if not jobs:
            break

        for job in jobs:
            # Skip duplicates
            if get_job(job["job_id"]):
                skip_count += 1
                continue

            if not is_banner_job(job["title"], job.get("description", "")):
                # Fetch detail to check
                job = scrape_job_detail(job)
                if not is_banner_job(job["title"], job.get("description", "")):
                    continue

            if not job.get("description"):
                job = scrape_job_detail(job)

            save_job(job)
            new_count += 1
            print(f"[Scraper] Saved job: {job['job_id']} - {job['title'][:50]}")
            time.sleep(SCRAPE_INTERVAL_SECONDS)

    print(f"[Scraper] Done. New: {new_count}, Skipped: {skip_count}")
    return {"message": f"Scraping complete. New jobs: {new_count}, Skipped: {skip_count}"}
