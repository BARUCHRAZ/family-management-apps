# סקריפט גירוד אתרים - הוראות שימוש

## התקנה

1. **התקנת Python** (אם לא מותקן):
   - הורד מ: https://www.python.org/downloads/
   - בחר "Add Python to PATH" במהלך ההתקנה

2. **התקנת הספריות הנדרשות**:
   ```bash
   pip install -r requirements.txt
   ```

   או התקנה ידנית:
   ```bash
   pip install requests beautifulsoup4 lxml
   ```

3. **להתקנת Selenium (אופציונלי - לתמיכה ב-JavaScript)**:
   ```bash
   pip install selenium
   ```
   וגם להוריד ChromeDriver מ: https://chromedriver.chromium.org/

## קבצים בפרויקט

- **web_scraper_fixed.py** - סקריפט בסיסי לגירוד אתרים
- **advanced_web_scraper.py** - סקריפט מתקדם עם תכונות נוספות
- **requirements.txt** - רשימת הספריות הנדרשות

## שימוש בסקריפט הבסיסי

```bash
python web_scraper_fixed.py
```

### תכונות הסקריפט הבסיסי:
- הזנת URLs ידנית
- חילוץ כותרות, תיאורים, קישורים ותמונות
- שמירה ב-JSON או CSV
- לוגים מפורטים
- טיפול בשגיאות

## שימוש בסקריפט המתקדם

```bash
python advanced_web_scraper.py
```

### תכונות נוספות בסקריפט המתקדם:
- תמיכה ב-JavaScript עם Selenium
- בדיקת קובץ robots.txt
- CSS selectors מותאמים אישית
- סינון קישורים פנימיים/חיצוניים
- דוח מפורט של תוצאות הגירוד
- חילוץ meta keywords
- ניקוי טקסט מתקדם

## דוגמאות שימוש

### דוגמה 1: גירוד בסיסי
```
=== סקריפט גירוד אתרים ===
הזן כתובות URL לגירוד (Enter ריק לסיום):
URL #1: https://example.com
URL #2: https://news.ycombinator.com
URL #3: [Enter]

השהיה בין בקשות (שניות, ברירת מחדל: 1): 2

בוחר פורמט שמירה:
1. JSON
2. CSV
3. שניהם
בחירה (1-3): 3
```

### דוגמה 2: שימוש ב-CSS Selectors מותאמים
```
להוסיף CSS selectors מותאמים? (y/n): y
שם השדה: titles
CSS selector עבור titles: h1, h2
שם השדה: prices
CSS selector עבור prices: .price, .cost
שם השדה: [Enter]
```

## קבצי פלט

הסקריפט יוצר קבצים הבאים:

### קבצי נתונים:
- `scraped_data_YYYYMMDD_HHMMSS.json` - נתונים ב-JSON
- `scraped_data_YYYYMMDD_HHMMSS.csv` - נתונים ב-CSV
- `scraper_report_YYYYMMDD_HHMMSS.json` - דוח סיכום (בגרסה המתקדמת)

### קבצי לוג:
- `scraper.log` - לוג פעילות הסקריפט

## מבנה נתונים שנגרדים

```json
{
  "url": "https://example.com",
  "title": "כותרת הדף",
  "meta_description": "תיאור הדף",
  "meta_keywords": "מילות מפתח",
  "headings": {
    "h1": ["כותרת ראשית"],
    "h2": ["כותרת משנית 1", "כותרת משנית 2"]
  },
  "links": [
    {
      "text": "טקסט הקישור",
      "url": "https://example.com/page",
      "is_internal": true
    }
  ],
  "images": [
    {
      "alt": "תיאור התמונה",
      "src": "https://example.com/image.jpg",
      "title": "כותרת התמונה"
    }
  ],
  "text_content": "תוכן הטקסט של הדף...",
  "page_size": 12345,
  "scraped_at": "2023-10-19T10:30:00",
  "custom_data": {
    "titles": ["כותרת 1", "כותרת 2"],
    "prices": ["$10", "$20"]
  }
}
```

## טיפים לשימוש

### 1. כיבוד robots.txt
הסקריפט המתקדם בודק אוטומטית את קובץ robots.txt ומכבד את ההגבלות.

### 2. השהיות בין בקשות
השתמש בהשהיות של לפחות 1-2 שניות כדי לא להעמיס על שרתים.

### 3. טיפול בשגיאות
הסקריפט ממשיך לעבוד גם אם אתר אחד נכשל, ומדווח על כל השגיאות בסוף.

### 4. CSS Selectors מותאמים
השתמש ב-CSS selectors לחילוץ נתונים ספציפיים:
- `.price` - מחלקה
- `#id` - ID
- `h1, h2` - מספר תגיות
- `.container .item` - תגיות מקוננות

### 5. פורמט קבצים
- JSON טוב לעיבוד נתונים עם Python
- CSV טוב לעבודה עם Excel או Google Sheets

## פתרון בעיות נפוצות

### שגיאה: "Module not found"
```bash
pip install [module_name]
```

### שגיאה: "Permission denied"
הרץ את הטרמינל כמנהל או בדוק הרשאות כתיבה לתיקייה.

### שגיאה: "SSL Certificate"
השתמש בפרוקסי או עקוף אימות SSL (לא מומלץ).

### אתר לא מגיב
- בדוק את השהיות
- נסה User-Agent שונה
- בדוק אם יש חסימת IP

## אבטחה ואתיקה

- כבד את קובץ robots.txt
- השתמש בהשהיות סבירות
- אל תעמיס על שרתים
- בדוק את התנאים המשפטיים של האתר
- השתמש בנתונים באופן אחראי

## תמיכה

במקרה של בעיות:
1. בדוק את קובץ הלוג `scraper.log`
2. וודא שכל הספריות מותקנות
3. בדוק את הרשאות הגישה לאתר
4. נסה עם השהיה גדולה יותר