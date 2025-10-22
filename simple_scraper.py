#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
דוגמה פשוטה לגירוד אתרים
שימוש מהיר ללא תלות חיצונית
"""

import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime

def simple_scrape(url):
    """גירוד פשוט של אתר יחיד"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # חילוץ מידע בסיסי
        title = soup.find('title').text.strip() if soup.find('title') else "ללא כותרת"
        
        # כותרות H1
        h1_tags = soup.find_all('h1')
        h1_texts = [h1.text.strip() for h1 in h1_tags]
        
        # קישורים
        links = []
        for a in soup.find_all('a', href=True)[:10]:  # רק 10 קישורים ראשונים
            links.append({
                'text': a.text.strip(),
                'url': a['href']
            })
        
        # תוכן טקסט קצר
        text_content = soup.get_text()[:500]  # 500 תווים ראשונים
        
        return {
            'url': url,
            'title': title,
            'h1_headings': h1_texts,
            'links': links,
            'text_preview': text_content,
            'scraped_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'status': 'success'
        }
        
    except Exception as e:
        return {
            'url': url,
            'error': str(e),
            'scraped_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'status': 'failed'
        }

def main():
    """הפעלה פשוטה"""
    print("=== גירוד אתרים מהיר ===")
    
    # דוגמאות URLs (ניתן לשנות)
    urls = [
        "https://www.python.org",
        "https://github.com",
        "https://stackoverflow.com"
    ]
    
    # אפשרות להזין URL מותאם
    custom_url = input("הזן URL מותאם (או Enter לדוגמאות): ").strip()
    if custom_url:
        if not custom_url.startswith(('http://', 'https://')):
            custom_url = 'https://' + custom_url
        urls = [custom_url]
    
    results = []
    
    for i, url in enumerate(urls, 1):
        print(f"מגרד {i}/{len(urls)}: {url}")
        result = simple_scrape(url)
        results.append(result)
        
        # הצגת תוצאה מיידית
        if result['status'] == 'success':
            print(f"  ✓ {result['title'][:50]}...")
        else:
            print(f"  ✗ שגיאה: {result['error']}")
    
    # שמירת תוצאות
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'simple_scrape_{timestamp}.json'
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\nתוצאות נשמרו ל: {filename}")
    
    # סיכום
    successful = sum(1 for r in results if r['status'] == 'success')
    print(f"הצליחו: {successful}/{len(results)}")

if __name__ == "__main__":
    main()