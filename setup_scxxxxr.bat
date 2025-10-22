@echo off
echo === התקנת סקריפט גירוד אתרים ===
echo.

REM בדיקה אם Python מותקן
python --version >nul 2>&1
if errorlevel 1 (
    echo שגיאה: Python אינו מותקן או אינו נמצא ב-PATH
    echo אנא התקן Python מ: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Python מותקן ✓
echo.

REM התקנת ספריות
echo מתקין ספריות נדרשות...
pip install requests beautifulsoup4 lxml

echo.
echo התקנה הושלמה!
echo.

REM הפעלת הסקריפט הפשוט
echo האם להפעיל את הסקריפט הפשוט כעת? (y/n)
set /p choice=
if /i "%choice%"=="y" (
    python simple_scraper.py
)

echo.
echo קבצים זמינים:
echo - simple_scraper.py (גירוד פשוט)
echo - web_scraper_fixed.py (גירוד בסיסי)
echo - advanced_web_scraper.py (גירוד מתקדם)
echo.
pause