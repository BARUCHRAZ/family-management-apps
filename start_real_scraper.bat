@echo off
echo === התקנת מערכת גירוד אתרים אמיתית ===
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

REM התקנת ספריות השרת
echo מתקין ספריות שרת...
pip install -r server-requirements.txt

echo.
echo התקנה הושלמה!
echo.

echo === הפעלת מערכת גירוד אתרים ===
echo.
echo השרת יופעל בכתובת: http://localhost:5000
echo האפליקציה תהיה זמינה באותה כתובת
echo.
echo לעצירת השרת: Ctrl+C
echo.

REM הפעלת השרת
python real_scraper_server.py