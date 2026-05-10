from __future__ import annotations
import html
import json
import time
import uuid
import re
import requests
from bs4 import BeautifulSoup
from backend.config import CROWDWORKS_COOKIE, CROWDWORKS_SEARCH_URL, BANNER_CATEGORY_PARAMS, SCRAPE_INTERVAL_SECONDS
from backend.db.supabase_client import save_jobs

BASE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; BannerSystemBot/1.0; educational purposes)",
    "Accept-Language": "ja-JP,ja;q=0.9",
}

BANNER_KEYWORDS = [
    "バナー", "banner", "ロゴ", "logo", "イラスト", "チラシ", "フライヤー",
    "デザイン", "サムネ", "キャラクター", "アイコン"
]


def _request_headers() -> dict:
    headers = dict(BASE_HEADERS)
    if CROWDWORKS_COOKIE:
        headers["Cookie"] = CROWDWORKS_COOKIE
    return headers


def is_banner_job(title: str, description: str) -> bool:
    text = (title + " " + description).lower()
    return any(kw.lower() in text for kw in BANNER_KEYWORDS)


def extract_job_id_from_url(url: str) -> str:
    match = re.search(r'/jobs/(\d+)', url)
    return f"CW{match.group(1)}" if match else str(uuid.uuid4())[:8]


def _format_reward(payment: dict) -> str:
    competition = payment.get("competition_payment") or {}
    competition_price = competition.get("competition_price")
    if competition_price:
        return f"{int(competition_price):,}円"

    fixed = payment.get("fixed_price_payment") or {}
    min_budget = fixed.get("min_budget")
    max_budget = fixed.get("max_budget")
    if max_budget:
        if min_budget:
            return f"{int(min_budget):,}円〜{int(max_budget):,}円"
        return f"〜{int(max_budget):,}円"
    return "要確認"


def _requirements_with_competition_marker(job_offer: dict) -> list[str]:
    skills = job_offer.get("skills") or []
    skill_names = [skill.get("name") for skill in skills if skill.get("name")]
    return ["コンペ形式", *skill_names]


def _parse_vue_job_list(soup: BeautifulSoup) -> list:
    container = soup.select_one("#vue-container[data]")
    if not container:
        return []

    try:
        data = json.loads(html.unescape(container.get("data", "")))
    except json.JSONDecodeError as e:
        print(f"[Scraper] Failed to parse embedded job JSON: {e}")
        return []

    jobs = []
    offers = data.get("searchResult", {}).get("job_offers", [])
    for offer in offers[:20]:
        job_offer = offer.get("job_offer") or {}
        job_id_raw = job_offer.get("id")
        if not job_id_raw:
            continue
        if job_offer.get("status") != "released":
            continue
        if "competition_payment" not in (offer.get("payment") or {}):
            continue

        href = f"https://crowdworks.jp/public/jobs/{job_id_raw}"
        jobs.append({
            "job_id": f"CW{job_id_raw}",
            "url": href,
            "title": (job_offer.get("title") or "Unknown")[:200],
            "reward": _format_reward(offer.get("payment") or {}),
            "deadline": job_offer.get("expired_on"),
            "client_name": (offer.get("client") or {}).get("username"),
            "description": (job_offer.get("description_digest") or "").replace("\r", "\n").strip(),
            "requirements": _requirements_with_competition_marker(job_offer),
            "attachments": [],
            "processed": False,
        })
    return jobs


def scrape_job_list(page: int = 1) -> list:
    """Scrape one page of job listings from Crowdworks."""
    params = {**BANNER_CATEGORY_PARAMS, "page": page}
    try:
        resp = requests.get(CROWDWORKS_SEARCH_URL, params=params, headers=_request_headers(), timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"[Scraper] Failed to fetch job list page {page}: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    jobs = _parse_vue_job_list(soup)
    if jobs:
        return jobs

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
    if SCRAPE_INTERVAL_SECONDS > 0:
        time.sleep(SCRAPE_INTERVAL_SECONDS)
    try:
        resp = requests.get(job["url"], headers=_request_headers(), timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"[Scraper] Failed to fetch job detail {job['url']}: {e}")
        return job

    soup = BeautifulSoup(resp.text, "html.parser")

    for script in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.string or "")
        except json.JSONDecodeError:
            continue
        if data.get("@type") != "JobPosting":
            continue

        if data.get("description"):
            description_html = html.unescape(data["description"])
            description_text = BeautifulSoup(description_html, "html.parser").get_text(separator="\n", strip=True)
            job["description"] = description_text
        if data.get("validThrough"):
            job["deadline"] = data["validThrough"]
        organization = data.get("hiringOrganization") or {}
        if organization.get("name"):
            job["client_name"] = organization["name"][:100]
        break

    # Extract description
    desc_el = soup.select_one(".job_description, .description, [class*='description'], #job_description")
    if desc_el and not job.get("description"):
        job["description"] = desc_el.get_text(separator="\n", strip=True)

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
    scrape_count = 0

    for page in range(1, 2):  # keep serverless execution short and predictable
        jobs = scrape_job_list(page)
        if not jobs:
            break

        banner_jobs = [
            job for job in jobs
            if is_banner_job(job["title"], job.get("description", ""))
        ]
        detailed_jobs = [scrape_job_detail(job) for job in banner_jobs]
        saved = save_jobs(detailed_jobs)
        scrape_count += len(saved)
        for job in saved:
            print(f"[Scraper] Saved job: {job['job_id']} - {job['title'][:50]}")

    print(f"[Scraper] Done. Saved/updated: {scrape_count}")
    return {"message": f"Scraping complete. Saved/updated jobs: {scrape_count}"}
