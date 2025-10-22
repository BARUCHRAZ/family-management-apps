#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
סקריפט אמיתי לגירוד אתרים - עם שרת Flask API
מאפשר לאפליקציית HTML לגרד תוכן אמיתי
"""

from flask import Flask, request, jsonify, render_template_string, send_from_directory
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import json
import time
import urllib.parse
import logging
from datetime import datetime
import os
import threading
from urllib.robotparser import RobotFileParser

# הגדרת לוגים
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # מאפשר CORS לכל הדומיינים

class RealWebScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'he-IL,he;q=0.8,en-US;q=0.5,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })
    
    def scrape_url(self, url, settings=None):
        """גירוד URL אמיתי"""
        if not settings:
            settings = {
                'delay': 1,
                'maxLinks': 20,
                'maxImages': 10,
                'textLength': 1000,
                'respectRobots': True
            }
        
        try:
            logger.info(f"מתחיל גירוד אמיתי: {url}")
            
            # בדיקת robots.txt אם נדרש
            if settings.get('respectRobots', True):
                if not self._check_robots_txt(url):
                    return {
                        'url': url,
                        'error': 'Access denied by robots.txt',
                        'status': 'error',
                        'scrapedAt': datetime.now().isoformat()
                    }
            
            # השהיה
            time.sleep(settings.get('delay', 1))
            
            # ביצוע הבקשה
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            response.encoding = response.apparent_encoding or 'utf-8'
            
            # פירוק HTML
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # חילוץ נתונים אמיתיים כולל HTML מלא
            result = {
                'url': url,
                'title': self._extract_title(soup),
                'description': self._extract_meta_description(soup),
                'keywords': self._extract_meta_keywords(soup),
                'headings': self._extract_headings(soup),
                'links': self._extract_links(soup, url, settings.get('maxLinks', 20)),
                'images': self._extract_images(soup, url, settings.get('maxImages', 10)),
                'textContent': self._extract_text_content(soup, settings.get('textLength', 1000)),
                'responseTime': int(response.elapsed.total_seconds() * 1000),
                'pageSize': len(response.content),
                'statusCode': response.status_code,
                'contentType': response.headers.get('content-type', ''),
                'lastModified': response.headers.get('last-modified', ''),
                'scrapedAt': datetime.now().isoformat(),
                'status': 'success',
                'fullHtml': response.text
            }
            
            logger.info(f"גירוד הושלם בהצלחה: {url}")
            return result
            
        except requests.exceptions.RequestException as e:
            logger.error(f"שגיאה בגירוד {url}: {e}")
            return {
                'url': url,
                'error': str(e),
                'status': 'error',
                'scrapedAt': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"שגיאה כללית בגירוד {url}: {e}")
            return {
                'url': url,
                'error': f"Internal error: {str(e)}",
                'status': 'error',
                'scrapedAt': datetime.now().isoformat()
            }
    
    def _check_robots_txt(self, url):
        """בדיקת robots.txt"""
        try:
            parsed_url = urllib.parse.urlparse(url)
            robots_url = f"{parsed_url.scheme}://{parsed_url.netloc}/robots.txt"
            
            rp = RobotFileParser()
            rp.set_url(robots_url)
            rp.read()
            
            user_agent = self.session.headers.get('User-Agent', '*')
            return rp.can_fetch(user_agent, url)
        except:
            return True  # במקרה של שגיאה, נאפשר גירוד
    
    def _extract_title(self, soup):
        """חילוץ כותרת אמיתית"""
        title = soup.find('title')
        if title:
            return title.get_text().strip()
        
        # נסיון נוסף - Open Graph title
        og_title = soup.find('meta', property='og:title')
        if og_title:
            return og_title.get('content', '').strip()
        
        return "ללא כותרת"
    
    def _extract_meta_description(self, soup):
        """חילוץ תיאור meta אמיתי"""
        # תיאור רגיל
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc:
            return meta_desc.get('content', '').strip()
        
        # Open Graph description
        og_desc = soup.find('meta', property='og:description')
        if og_desc:
            return og_desc.get('content', '').strip()
        
        return ""
    
    def _extract_meta_keywords(self, soup):
        """חילוץ מילות מפתח meta"""
        meta_keywords = soup.find('meta', attrs={'name': 'keywords'})
        return meta_keywords.get('content', '').strip() if meta_keywords else ""
    
    def _extract_headings(self, soup):
        """חילוץ כותרות אמיתיות"""
        headings = {}
        for i in range(1, 7):
            tags = soup.find_all(f'h{i}')
            if tags:
                headings[f'h{i}'] = [tag.get_text().strip() for tag in tags if tag.get_text().strip()]
        return headings
    
    def _extract_links(self, soup, base_url, max_links):
        """חילוץ קישורים אמיתיים"""
        links = []
        base_domain = urllib.parse.urlparse(base_url).netloc
        
        for link in soup.find_all('a', href=True):
            if len(links) >= max_links:
                break
                
            href = link['href'].strip()
            if not href or href.startswith('#') or href.startswith('javascript:'):
                continue
            
            # המרה לכתובת מוחלטת
            absolute_url = urllib.parse.urljoin(base_url, href)
            link_domain = urllib.parse.urlparse(absolute_url).netloc
            
            # חילוץ טקסט הקישור
            link_text = link.get_text().strip()
            if not link_text:
                # נסיון לחלץ מ-title או aria-label
                link_text = link.get('title', '').strip() or link.get('aria-label', '').strip() or 'קישור ללא טקסט'
            
            links.append({
                'text': link_text[:100],  # מגביל אורך טקסט
                'url': absolute_url,
                'isInternal': link_domain == base_domain,
                'title': link.get('title', '').strip()
            })
        
        return links
    
    def _extract_images(self, soup, base_url, max_images):
        """חילוץ תמונות אמיתיות"""
        images = []
        
        for img in soup.find_all('img'):
            if len(images) >= max_images:
                break
                
            src = img.get('src', '').strip()
            if not src:
                # נסיון לחלץ מ-data-src (lazy loading)
                src = img.get('data-src', '').strip()
            
            if not src:
                continue
            
            # המרה לכתובת מוחלטת
            absolute_url = urllib.parse.urljoin(base_url, src)
            
            images.append({
                'src': absolute_url,
                'alt': img.get('alt', '').strip(),
                'title': img.get('title', '').strip(),
                'width': img.get('width', ''),
                'height': img.get('height', ''),
                'loading': img.get('loading', ''),
                'class': ' '.join(img.get('class', []))
            })
        
        return images
    
    def _extract_text_content(self, soup, max_length):
        """חילוץ תוכן טקסט אמיתי"""
        # הסרת אלמנטים לא רלוונטיים
        for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript']):
            element.decompose()
        
        # חיפוש תוכן עיקרי
        main_content = None
        
        # נסיון למצוא תוכן עיקרי לפי תגיות ומחלקות נפוצות
        for selector in ['main', 'article', '.content', '.main-content', '.post-content', '#content', '.entry-content']:
            main_content = soup.select_one(selector)
            if main_content:
                break
        
        # אם לא נמצא תוכן עיקרי, נשתמש בכל הגוף
        if not main_content:
            main_content = soup.find('body') or soup
        
        # חילוץ טקסט נקי
        text = main_content.get_text(separator=' ', strip=True)
        
        # ניקוי טקסט מתקדם
        lines = [line.strip() for line in text.splitlines()]
        lines = [line for line in lines if line and len(line) > 3]  # הסרת שורות קצרות מדי
        
        # איחוד שורות
        text = ' '.join(lines)
        
        # ניקוי רווחים מיותרים
        import re
        text = re.sub(r'\s+', ' ', text)
        
        # החזרת טקסט חתוך לפי הגבלה
        return text[:max_length] if text else ""

# יצירת instance גלובלי
scraper = RealWebScraper()

@app.route('/')
def home():
    """דף בית עם ממשק הגירוד"""
    return send_from_directory('.', 'scraper-app.html')

@app.route('/<path:filename>')
def static_files(filename):
    """קבצים סטטיים"""
    return send_from_directory('.', filename)

@app.route('/api/scrape', methods=['POST'])
def api_scrape():
    """API לגירוד אתר יחיד"""
    try:
        data = request.json
        url = data.get('url')
        settings = data.get('settings', {})
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        result = scraper.scrape_url(url, settings)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"שגיאה ב-API: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/scrape_multiple', methods=['POST'])
def api_scrape_multiple():
    """API לגירוד מרובה"""
    try:
        data = request.json
        urls = data.get('urls', [])
        settings = data.get('settings', {})
        
        if not urls:
            return jsonify({'error': 'URLs are required'}), 400
        
        results = []
        for url in urls:
            result = scraper.scrape_url(url, settings)
            results.append(result)
        
        return jsonify({'results': results})
        
    except Exception as e:
        logger.error(f"שגיאה ב-API מרובה: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/test')
def api_test():
    """בדיקת חיבור API"""
    return jsonify({
        'status': 'OK',
        'message': 'Real Web Scraper API is running',
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    print("🕷️ מפעיל שרת גירוד אתרים אמיתי...")
    print("📡 השרת יהיה זמין בכתובת: http://localhost:5000")
    print("🌐 האפליקציה תהיה זמינה ב: http://localhost:5000")
    print("⚡ API endpoint: http://localhost:5000/api/scrape")
    print("🔄 לעצירה: Ctrl+C")
    
    app.run(host='0.0.0.0', port=5000, debug=False)