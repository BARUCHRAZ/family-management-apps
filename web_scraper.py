#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
סקריפט לגירוד אתרים
מאפשר לגרד מידע מכתובות URL ספציפיות
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

# הגדרות בסיסיות
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

class WebScraper:
    def __init__(self):
        self.session = requests.Session()
        # הוספת User-Agent כדי לחקות דפדפן רגיל
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.scraped_data = []
    
    def scxxxxxxxx(self, url, delay=1):
        """
        גירוד כתובת URL ספציפית
        
        Args:
            url (str): כתובת URL לגירוד
            delay (int): השהיה בשניות בין בקשות
        
        Returns:
            dict: נתונים שנגרדו מהאתר
        """
        try:
            logging.info(f"מתחיל גירוד: {url}")
            
            # השהיה כדי לא להעמיס על השרת
            time.sleep(delay)
            
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            # זיהוי קידוד הטקסט
            response.encoding = response.apparent_encoding
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # חילוץ מידע בסיסי
            data = {
                'url': url,
                'title': self._get_title(soup),
                'meta_description': self._get_meta_description(soup),
                'headings': self._get_headings(soup),
                'links': self._get_links(soup, url),
                'images': self._get_images(soup, url),
                'text_content': self._get_text_content(soup),
                'scraped_at': datetime.now().isoformat()
            }
            
            logging.info(f"גירוד הושלם בהצלחה: {url}")
            return data
            
        except requests.exceptions.RequestException as e:
            logging.error(f"שגיאה בגירוד {url}: {e}")
            return {
                'url': url,
                'error': str(e),
                'scraped_at': datetime.now().isoformat()
            }
    
    def _get_title(self, soup):
        """חילוץ כותרת העמוד"""
        title_tag = soup.find('title')
        return title_tag.text.strip() if title_tag else ""
    
    def _get_meta_description(self, soup):
        """חילוץ תיאור meta"""
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        return meta_desc.get('content', '').strip() if meta_desc else ""
    
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
            # המרה לכתובת מוחלטת
            absolute_url = urllib.parse.urljoin(base_url, href)
            links.append({
                'text': link.text.strip(),
                'url': absolute_url
            })
        return links[:20]  # מגביל ל-20 קישורים ראשונים
    
    def _get_images(self, soup, base_url):
        """חילוץ תמונות"""
        images = []
        for img in soup.find_all('img', src=True):
            src = img['src']
            # המרה לכתובת מוחלטת
            absolute_url = urllib.parse.urljoin(base_url, src)
            images.append({
                'alt': img.get('alt', ''),
                'src': absolute_url
            })
        return images[:10]  # מגביל ל-10 תמונות ראשונות
    
    def _get_text_content(self, soup):
        """חילוץ תוכן טקסט"""
        # הסרת סקריפטים וסגנונות
        for script in soup(["script", "style"]):
            script.decompose()
        
        text = soup.get_text()
        # ניקוי הטקסט
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        # החזרת 1000 תווים ראשונים
        return text[:1000] if text else ""
    
    def scrape_multiple_urls(self, urls, delay=1):
        """
        גירוד מספר כתובות URL
        
        Args:
            urls (list): רשימת כתובות URL
            delay (int): השהיה בשניות בין בקשות
        """
        self.scraped_data = []
        
        for i, url in enumerate(urls, 1):
            print(f"מגרד אתר {i}/{len(urls)}: {url}")
            data = self.scrape_url(url, delay)
            self.scraped_data.append(data)
        
        return self.scraped_data
    
    def save_to_json(self, filename='scraped_data.json'):
        """שמירה לקובץ JSON"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.scraped_data, f, ensure_ascii=False, indent=2)
        logging.info(f"נתונים נשמרו ל: {filename}")
    
    def save_to_csv(self, filename='scxxxxxxxxxx.csv'):
        """שמירה לקובץ CSV"""
        if not self.scraped_data:
            return
        
        with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
            fieldnames = ['url', 'title', 'meta_description', 'text_content', 'scraped_at']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            
            writer.writeheader()
            for data in self.scraped_data:
                # הכנת שורה לCSV
                row = {
                    'url': data.get('url', ''),
                    'title': data.get('title', ''),
                    'meta_description': data.get('meta_description', ''),
                    'text_content': data.get('text_content', ''),
                    'scraped_at': data.get('scxxxxx_at', '')
                }
                writer.writerow(row)
        
        logging.info(f"נתונים נשמרו ל: {filename}")

def main():
    """פונקציה ראשית להפעלת הסקריפט"""
    scraper = WebScraper()
    
    print("=== סקריפט גירוד אתרים ===")
    print("הזן כתובות URL לגירוד (Enter ריק לסיום):")
    
    urls = []
    while True:
        url = input(f"URL #{len(urls) + 1}: ").strip()
        if not url:
            break
        
        # בדיקה בסיסית של URL
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        urls.append(url)
    
    if not urls:
        print("לא הוזנו כתובות URL.")
        return
    
    # הגדרות גירוד
    delay = input("השהיה בין בקשות (שניות, ברירת מחדל: 1): ").strip()
    delay = int(delay) if delay.isdigit() else 1
    
    # תחילת גירוד
    print(f"\nמתחיל גירוד {len(urls)} אתרים...")
    data = scraper.scrape_multiple_urls(urls, delay)
    
    # שמירת נתונים
    print("\nבוחר פורמט שמירה:")
    print("1. JSON")
    print("2. CSV")
    print("3. שניהם")
    
    choice = input("בחירה (1-3): ").strip()
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    if choice in ['1', '3']:
        scraper.save_to_json(f'scraped_data_{timestamp}.json')
    
    if choice in ['2', '3']:
        scraper.save_to_csv(f'scraped_data_{timestamp}.csv')
    
    print(f"\nגירוד הושלם! נגרדו {len(data)} אתרים.")
    
    # הצגת סיכום
    successful = sum(1 for item in data if 'error' not in item)
    failed = len(data) - successful
    
    print(f"הצלחות: {successful}")
    print(f"כשלונות: {failed}")

if __name__ == "__main__":
    main()