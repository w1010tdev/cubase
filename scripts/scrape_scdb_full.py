import requests
from bs4 import BeautifulSoup
import json
import time
from urllib.parse import urljoin
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import urllib3
import ssl

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class TLSAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.set_ciphers('DEFAULT@SECLEVEL=1')
        ctx.check_hostname = False
        kwargs['ssl_context'] = ctx
        return super(TLSAdapter, self).init_poolmanager(*args, **kwargs)

# Setup session
session = requests.Session()
retry = Retry(
    total=5,
    read=5,
    connect=5,
    backoff_factor=1,
    status_forcelist=(500, 502, 504)
)
adapter = TLSAdapter(max_retries=retry)
session.mount('http://', adapter)
session.mount('https://', adapter)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
}

BASE_URL = 'https://speedcubedb.com'
PUZZLES = ['3x3', '2x2', '4x4', '5x5']

all_data = {}

def get_soup(url):
    try:
        r = session.get(url, headers=HEADERS, timeout=20, verify=False)
        r.raise_for_status()
        return BeautifulSoup(r.text, 'html.parser')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def parse_cases(soup):
    cases_data = []
    cases = soup.find_all('div', class_='singlealgorithm')
    for c in cases:
        case_name = c.get('data-alg', 'Unknown')
        subgroup = c.get('data-subgroup', '')
        
        # Standard alg
        std_alg_div = c.find('div', class_='scdb-panel')
        algs = []
        if std_alg_div:
            std_text = std_alg_div.text.replace('Standard Alg:', '').strip()
            if std_text:
                lines = [line.strip() for line in std_text.split('\n') if line.strip()]
                if lines:
                    algs.append(lines[0])
        
        # Alternatives
        alt_divs = c.find_all('div', class_='formatted-alg')
        for alt in alt_divs:
            alt_text = alt.text.strip()
            if alt_text and alt_text not in algs:
                algs.append(alt_text)
                
        cases_data.append({
            'name': case_name,
            'subgroup': subgroup,
            'algorithms': algs
        })
    return cases_data

for puzzle in PUZZLES:
    all_data[puzzle] = {}
    print(f"\n--- Scraping {puzzle} ---")
    
    url = f"{BASE_URL}/a/{puzzle}"
    soup = get_soup(url)
    if not soup:
        continue
        
    cats = set()
    for a in soup.find_all('a'):
        href = a.get('href', '').lstrip('/')
        if href.startswith(f'a/{puzzle}/'):
            parts = href.split('/')
            if len(parts) == 3:
                cats.add(parts[2])
    
    cats = sorted(list(cats))
    print(f"Found categories: {cats}")
    
    for cat in cats:
        cat_url = f"{BASE_URL}/a/{puzzle}/{cat}"
        print(f"  Fetching category {cat}: {cat_url}")
        
        cat_soup = get_soup(cat_url)
        if not cat_soup:
            continue
            
        cases = parse_cases(cat_soup)
        
        if len(cases) > 0:
            print(f"    Found {len(cases)} cases.")
            all_data[puzzle][cat] = cases
        else:
            # Check for subcategories
            print(f"    0 cases found. Checking for subcategories...")
            subcats = set()
            for a in cat_soup.find_all('a'):
                href = a.get('href', '').lstrip('/')
                # if href is like a/3x3/ZBLLU, it starts with a/3x3/ZBLL
                if href.startswith(f'a/{puzzle}/{cat}') and href != f'a/{puzzle}/{cat}':
                    subcats.add(href)
            
            subcats = sorted(list(subcats))
            if subcats:
                print(f"    Found {len(subcats)} subcategories.")
                all_data[puzzle][cat] = []
                for subcat_href in subcats:
                    subcat_url = f"{BASE_URL}/{subcat_href}"
                    print(f"      Fetching subcat {subcat_href}...")
                    sub_soup = get_soup(subcat_url)
                    if sub_soup:
                        sub_cases = parse_cases(sub_soup)
                        print(f"        Found {len(sub_cases)} cases.")
                        all_data[puzzle][cat].extend(sub_cases)
                    time.sleep(0.5)
            else:
                print(f"    No subcategories found. Category might be empty.")
        
        time.sleep(0.5)

with open('D:/work/projects/cubase/speedcubedb_full.json', 'w', encoding='utf-8') as f:
    json.dump(all_data, f, indent=2, ensure_ascii=False)
print("\nDone! Saved to speedcubedb_full.json")
