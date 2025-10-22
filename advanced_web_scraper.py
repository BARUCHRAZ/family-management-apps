#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
סקריפט מתקדם לגירוד אתרים עם תכונות נוספות
תומך ב: פרוקסי, cookies, JavaScript rendering (עם Selenium), filters מותאמים אישית
"""

import requests
from bs4 import BeautifulSoup
import json
import csv
import time
import urllib.parse
import logging
from datetime import datetime
import os
import re
from urllib.robotparser import RobotFileParser
from pathlib import Path

# אופציונלי - לתמיכה ב-JavaScript rendering
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False

# הגדרות בסיסיות
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

class AdvancedWebScraper:
    def __init__(self, use_selenium=False, proxy=None):
        self.session = requests.Session()
        self.use_selenium = use_selenium and SELENIUM_AVAILABLE
        self.proxy = proxy
        self.scraped_data = []
        
        # הגדרת headers
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'he-IL,he;q=0.8,en-US;q=0.5,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })
        
        # הגדרת פרוקסי
        if proxy:
            self.session.proxies.update(proxy)
        
        # הגדרת Selenium
        if self.use_selenium:
            self._setup_selenium()
    
    def _setup_selenium(self):
        """הגדרת דפדפן Selenium"""
        chrome_options = Options()
        chrome_options.add_argument('--headless')  # ללא GUI
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument(f'--user-agent={self.session.headers["User-Agent"]}')
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            logging.info("Selenium Chrome driver הופעל בהצלחה")
        except Exception as e:
            logging.error(f"שגיאה בהפעלת Selenium: {e}")
            self.use_selenium = False
    
    def check_robots_txt(self, url):
        """בדיקת קובץ robots.txt"""
        try:
            parsed_url = urllib.parse.urlparse(url)
            robots_url = f"{parsed_url.scheme}://{parsed_url.netloc}/robots.txt"
            
            rp = RobotFileParser()
            rp.set_url(robots_url)
            rp.read()
            
            user_agent = self.session.headers.get('User-Agent', '*')
            can_fetch = rp.can_fetch(user_agent, url)
            
            if not can_fetch:
                logging.warning(f"robots.txt אוסר על גירוד: {url}")
            
            return can_fetch
        except Exception as e:
            logging.warning(f"לא ניתן לבדוק robots.txt עבור {url}: {e}")
            return True  # במקרה של שגיאה, נאפשר גירוד
    
    def scrape_url(self, url, delay=1, custom_selectors=None, respect_robots=True):
        """
        גירוד כתובת URL עם אפשרויות מתקדמות
        
        Args:
            url (str): כתובת URL לגירוד
            delay (int): השהיה בשניות בין בקשות
            custom_selectors (dict): CSS selectors מותאמים אישית
            respect_robots (bool): האם לכבד קובץ robots.txt
        
        Returns:
            dict: נתונים שנגרדו מהאתר
        """
        try:
            # בדיקת robots.txt
            if respect_robots and not self.check_robots_txt(url):
                return {
                    'url': url,
                    'error': 'Access denied by robots.txt',
                    'scraped_at': datetime.now().isoformat()
                }
            
            logging.info(f"מתחיל גירוד: {url}")
            
            # השהיה
            time.sleep(delay)
            
            if self.use_selenium:
                data = self._scrape_with_selenium(url, custom_selectors)
            else:
                data = self._scrape_with_requests(url, custom_selectors)
            
            logging.info(f"גירוד הושלם בהצלחה: {url}")
            return data
            
        except Exception as e:
            logging.error(f"שגיאה בגירוד {url}: {e}")
            return {
                'url': url,
                'error': str(e),
                'scraped_at': datetime.now().isoformat()
            }
    
    def _scrape_with_requests(self, url, custom_selectors):
        """גירוד עם requests רגיל"""
        response = self.session.get(url, timeout=10)
        response.raise_for_status()
        response.encoding = response.apparent_encoding
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        return self._extract_data(soup, url, custom_selectors)
    
    def _scrape_with_selenium(self, url, custom_selectors):
        """גירוד עם Selenium (תומך ב-JavaScript)"""
        self.driver.get(url)
        
        # המתנה לטעינת הדף
        time.sleep(2)
        
        # קבלת HTML לאחר רינדור JavaScript
        html = self.driver.page_source
        soup = BeautifulSoup(html, 'html.parser')
        
        return self._extract_data(soup, url, custom_selectors)
    
    def _extract_data(self, soup, url, custom_selectors):
        """חילוץ נתונים מהאתר"""
        data = {
            'url': url,
            'title': self._get_title(soup),
            'meta_description': self._get_meta_description(soup),
            'meta_keywords': self._get_meta_keywords(soup),
            'headings': self._get_headings(soup),
            'links': self._get_links(soup, url),
            'images': self._get_images(soup, url),
            'text_content': self._get_text_content(soup),
            'page_size': len(str(soup)),
            'scraped_at': datetime.now().isoformat()
        }
        
        # חילוץ נתונים מותאמים אישית
        if custom_selectors:
            data['custom_data'] = self._extract_custom_data(soup, custom_selectors)
        
        return data
    
    def _extract_custom_data(self, soup, selectors):
        """חילוץ נתונים לפי CSS selectors מותאמים"""
        custom_data = {}
        
        for name, selector in selectors.items():
            try:
                elements = soup.select(selector)
                if elements:
                    custom_data[name] = [elem.get_text(strip=True) for elem in elements]
                else:
                    custom_data[name] = []
            except Exception as e:
                logging.warning(f"שגיאה בחילוץ {name}: {e}")
                custom_data[name] = []
        
        return custom_data
    
    def _get_title(self, soup):
        """חילוץ כותרת העמוד"""
        title_tag = soup.find('title')
        return title_tag.text.strip() if title_tag else ""
    
    def _get_meta_description(self, soup):
        """חילוץ תיאור meta"""
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        return meta_desc.get('content', '').strip() if meta_desc else ""
    
    def _get_meta_keywords(self, soup):
        """חילוץ מילות מפתח meta"""
        meta_keywords = soup.find('meta', attrs={'name': 'keywords'})
        return meta_keywords.get('content', '').strip() if meta_keywords else ""
    
    def _get_headings(self, soup):
        """חילוץ כותרות (H1-H6)"""
        headings = {}
        for i in range(1, 7):
            tags = soup.find_all(f'h{i}')
            if tags:
                headings[f'h{i}'] = [tag.text.strip() for tag in tags]
        return headings
    
    def _get_links(self, soup, base_url):
        """חילוץ קישורים"""
        links = []
        for link in soup.find_all('a', href=True):
            href = link['href']
            absolute_url = urllib.parse.urljoin(base_url, href)
            
            # סינון קישורים פנימיים/חיצוניים
            is_internal = urllib.parse.urlparse(absolute_url).netloc == urllib.parse.urlparse(base_url).netloc
            
            links.append({
                'text': link.text.strip(),
                'url': absolute_url,
                'is_internal': is_internal
            })
        return links[:50]  # מגביל ל-50 קישורים
    
    def _get_images(self, soup, base_url):
        """חילוץ תמונות"""
        images = []
        for img in soup.find_all('img'):
            src = img.get('src', '')
            if src:
                absolute_url = urllib.parse.urljoin(base_url, src)
                images.append({
                    'alt': img.get('alt', ''),
                    'src': absolute_url,
                    'title': img.get('title', ''),
                    'width': img.get('width', ''),
                    'height': img.get('height', '')
                })
        return images[:20]  # מגביל ל-20 תמונות
    
    def _get_text_content(self, soup):
        """חילוץ תוכן טקסט נקי"""
        # הסרת סקריפטים וסגנונות
        for script in soup(["script", "style", "meta", "link"]):
            script.decompose()
        
        text = soup.get_text()
        
        # ניקוי טקסט מתקדם
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        # הסרת רווחים מיותרים
        text = re.sub(r'\s+', ' ', text)
        
        return text[:2000] if text else ""  # מגדיל ל-2000 תווים
    
    def scrape_multiple_urls(self, urls, delay=1, custom_selectors=None, respect_robots=True):
        """גירוד מספר כתובות URL"""
        self.scraped_data = []
        
        for i, url in enumerate(urls, 1):
            print(f"מגרד אתר {i}/{len(urls)}: {url}")
            data = self.scrape_url(url, delay, custom_selectors, respect_robots)
            self.scraped_data.append(data)
        
        return self.scraped_data
    
    def save_to_json(self, filename='scraped_data.json'):
        """שמירה לקובץ JSON"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.scraped_data, f, ensure_ascii=False, indent=2)
        logging.info(f"נתונים נשמרו ל: {filename}")
    
    def save_to_csv(self, filename='scraped_data.csv'):
        """שמירה לקובץ CSV מפורט"""
        if not self.scraped_data:
            return
        
        with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
            fieldnames = ['url', 'title', 'meta_description', 'meta_keywords', 
                         'text_content', 'page_size', 'scraped_at', 'error']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            
            writer.writeheader()
            for data in self.scraped_data:
                row = {
                    'url': data.get('url', ''),
                    'title': data.get('title', ''),
                    'meta_description': data.get('meta_description', ''),
                    'meta_keywords': data.get('meta_keywords', ''),
                    'text_content': data.get('text_content', ''),
                    'page_size': data.get('page_size', ''),
                    'scraped_at': data.get('scraped_at', ''),
                    'error': data.get('error', '')
                }
                writer.writerow(row)
        
        logging.info(f"נתונים נשמרו ל: {filename}")
    
    def generate_report(self):
        """יצירת דוח סיכום"""
        if not self.scraped_data:
            return
        
        successful = [item for item in self.scraped_data if 'error' not in item]
        failed = [item for item in self.scraped_data if 'error' in item]
        
        report = {
            'summary': {
                'total_sites': len(self.scraped_data),
                'successful': len(successful),
                'failed': len(failed),
                'success_rate': f"{(len(successful)/len(self.scraped_data)*100):.1f}%"
            },
            'successful_sites': [item['url'] for item in successful],
            'failed_sites': [{'url': item['url'], 'error': item['error']} for item in failed],
            'generated_at': datetime.now().isoformat()
        }
        
        # שמירת דוח
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = f'scraper_report_{timestamp}.json'
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        print(f"דוח נוצר: {report_file}")
        return report
    
    def __del__(self):
        """סגירת משאבים"""
        if hasattr(self, 'driver') and self.driver:
            self.driver.quit()

def main():
    """פונקציה ראשית מתקדמת"""
    print("=== סקריפט גירוד אתרים מתקדם ===")
    
    # אפשרויות מתקדמות
    use_selenium = input("להשתמש ב-Selenium לתמיכה ב-JavaScript? (y/n): ").lower() == 'y'
    if use_selenium and not SELENIUM_AVAILABLE:
        print("Selenium לא מותקן. ממשיך עם requests רגיל.")
        use_selenium = False
    
    respect_robots = input("לכבד קובץ robots.txt? (y/n, ברירת מחדל: y): ").lower() != 'n'
    
    # יצירת scraper
    scraper = AdvancedWebScraper(use_selenium=use_selenium)
    
    # קלט URLs
    print("\nהזן כתובות URL לגירוד (Enter ריק לסיום):")
    urls = []
    while True:
        url = input(f"URL #{len(urls) + 1}: ").strip()
        if not url:
            break
        
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        urls.append(url)
    
    if not urls:
        print("לא הוזנו כתובות URL.")
        return
    
    # CSS selectors מותאמים (אופציונלי)
    custom_selectors = {}
    use_custom = input("\nלהוסיף CSS selectors מותאמים? (y/n): ").lower() == 'y'
    if use_custom:
        print("הזן CSS selectors (Enter ריק לסיום):")
        while True:
            name = input("שם השדה: ").strip()
            if not name:
                break
            selector = input(f"CSS selector עבור {name}: ").strip()
            if selector:
                custom_selectors[name] = selector
    
    # הגדרות גירוד
    delay = input("\nהשהיה בין בקשות (שניות, ברירת מחדל: 1): ").strip()
    delay = int(delay) if delay.isdigit() else 1
    
    # תחילת גירוד
    print(f"\nמתחיל גירוד {len(urls)} אתרים...")
    data = scraper.scrape_multiple_urls(urls, delay, custom_selectors or None, respect_robots)
    
    # שמירת נתונים
    print("\nבוחר פורמט שמירה:")
    print("1. JSON")
    print("2. CSV")
    print("3. שניהם + דוח")
    
    choice = input("בחירה (1-3): ").strip()
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    if choice in ['1', '3']:
        scraper.save_to_json(f'scraped_data_{timestamp}.json')
    
    if choice in ['2', '3']:
        scraper.save_to_csv(f'scraped_data_{timestamp}.csv')
    
    if choice == '3':
        report = scraper.generate_report()
        print(f"\nסיכום הגירוד:")
        print(f"סך הכל: {report['summary']['total_sites']}")
        print(f"הצליחו: {report['summary']['successful']}")
        print(f"נכשלו: {report['summary']['failed']}")
        print(f"אחוז הצלחה: {report['summary']['success_rate']}")
    
    print(f"\nגירוד הושלם!")

if __name__ == "__main__":
    main()