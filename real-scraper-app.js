// פונקציה להורדת קובץ HTML מלא
function downloadFullHtml(index) {
    if (!app || !app.results || !app.results[index] || !app.results[index].fullHtml) {
        alert('לא נמצא קוד HTML מלא עבור תוצאה זו');
        return;
    }
    const html = app.results[index].fullHtml;
    const url = app.results[index].url || 'page';
    // הפוך את ה-URL לשם קובץ חוקי
    let filename = url.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9\-_\.]/g, '_').slice(0, 40) + '.html';
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// פונקציה גלובלית לפתיחת דף מלא בחלון חדש
function showFullHtml(index) {
    if (!app || !app.results || !app.results[index] || !app.results[index].fullHtml) {
        alert('לא נמצא קוד HTML מלא עבור תוצאה זו');
        return;
    }
    const win = window.open('', '_blank');
    win.document.open();
    win.document.write(app.results[index].fullHtml);
    win.document.close();
}
// אפליקציית גירוד אתרים - JavaScript מעודכן עם חיבור לשרת אמיתי
class RealWebScraperApp {
    constructor() {
        this.urls = [];
        this.results = [];
        this.isScraping = false;
        this.currentIndex = 0;
        this.selectedExportFormat = null;
        this.apiBaseUrl = 'http://localhost:5000/api';
        this.init();
    }

    init() {
        // האזנה ל-Enter בשדה הקלט
        document.getElementById('urlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addUrl();
            }
        });
        
        // בדיקת חיבור לשרת
        this.checkServerConnection();
    }

    // בדיקת חיבור לשרת
    async checkServerConnection() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/test`);
            if (response.ok) {
                this.showToast('שרת הגירוד מחובר ומוכן לפעולה! 🚀');
                document.getElementById('serverStatus').innerHTML = 
                    '<span style="color: #28a745;">✅ שרת פעיל</span>';
            } else {
                throw new Error('Server not responding');
            }
        } catch (error) {
            this.showToast('שרת הגירוד לא זמין. הפעל את real_scraper_server.py', 'error');
            document.getElementById('serverStatus').innerHTML = 
                '<span style="color: #dc3545;">❌ שרת לא פעיל</span>';
        }
    }

    // הוספת URL
    addUrl() {
        const urlInput = document.getElementById('urlInput');
        let url = urlInput.value.trim();
        
        if (!url) {
            this.showToast('אנא הזן כתובת אתר', 'error');
            return;
        }

        // בדיקה ותיקון URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        // בדיקה אם URL כבר קיים
        if (this.urls.includes(url)) {
            this.showToast('האתר כבר קיים ברשימה', 'error');
            return;
        }

        this.urls.push(url);
        urlInput.value = '';
        this.updateUrlList();
        this.showToast('האתר נוסף בהצלחה');
    }

    // עדכון רשימת URLs
    updateUrlList() {
        const urlList = document.getElementById('urlList');
        urlList.innerHTML = '';

        this.urls.forEach((url, index) => {
            const li = document.createElement('li');
            li.className = 'url-item';
            li.innerHTML = `
                <div class="url-text">${url}</div>
                <div>
                    <span class="status-indicator" id="status-${index}"></span>
                    <button onclick="app.removeUrl(${index})" class="btn btn-danger btn-sm">הסר</button>
                </div>
            `;
            urlList.appendChild(li);
        });
    }

    // הסרת URL
    removeUrl(index) {
        this.urls.splice(index, 1);
        this.updateUrlList();
        this.showToast('האתר הוסר מהרשימה');
    }

    // ניקוי כל ה-URLs
    clearUrls() {
        if (this.urls.length === 0) {
            this.showToast('הרשימה כבר ריקה', 'error');
            return;
        }

        if (confirm('האם אתה בטוח שברצונך לנקות את כל הרשימה?')) {
            this.urls = [];
            this.results = [];
            this.updateUrlList();
            this.hideResults();
            this.showToast('הרשימה נוקתה בהצלחה');
        }
    }

    // התחלת גירוד אמיתי
    async startScraping() {
        if (this.urls.length === 0) {
            this.showToast('אנא הוסף לפחות אתר אחד לגירוד', 'error');
            return;
        }

        if (this.isScraping) {
            this.showToast('גירוד כבר מתבצע', 'error');
            return;
        }

        // בדיקת חיבור לשרת
        try {
            const response = await fetch(`${this.apiBaseUrl}/test`);
            if (!response.ok) {
                throw new Error('Server not available');
            }
        } catch (error) {
            this.showToast('שרת הגירוד לא זמין. אנא הפעל את real_scraper_server.py', 'error');
            return;
        }

        this.isScraping = true;
        this.currentIndex = 0;
        this.results = [];
        
        // עדכון UI
        this.updateScrapingUI(true);
        this.showProgress();
        
        // קבלת הגדרות
        const settings = this.getSettings();
        
        try {
            // גירוד אתר אחר אתר
            for (let i = 0; i < this.urls.length; i++) {
                if (!this.isScraping) break; // אם המשתמש עצר
                
                this.currentIndex = i;
                this.updateProgress();
                this.updateUrlStatus(i, 'pending');
                
                this.showToast(`מגרד אתר ${i + 1}/${this.urls.length}: ${this.getDomainFromUrl(this.urls[i])}`);
                
                const result = await this.scrapeUrlReal(this.urls[i], settings);
                this.results.push(result);
                
                this.updateUrlStatus(i, result.status);
                this.updateProgress();
            }
            
            this.showToast('גירוד הושלם בהצלחה! 🎉');
            this.displayResults();
            
        } catch (error) {
            this.showToast('שגיאה בגירוד: ' + error.message, 'error');
        } finally {
            this.updateScrapingUI(false);
            this.hideProgress();
        }
    }

    // גירוד URL אמיתי דרך השרת
    async scrapeUrlReal(url, settings) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/scrape`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: url,
                    settings: settings
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return result;

        } catch (error) {
            return {
                url: url,
                error: error.message,
                status: 'error',
                scrapedAt: new Date().toISOString()
            };
        }
    }

    // עצירת גירוד
    stopScraping() {
        if (!this.isScraping) return;
        
        this.isScraping = false;
        this.showToast('גירוד הופסק על ידי המשתמש');
        this.updateScrapingUI(false);
        this.hideProgress();
        
        if (this.results.length > 0) {
            this.displayResults();
        }
    }

    // קבלת הגדרות מהטופס
    getSettings() {
        return {
            delay: parseFloat(document.getElementById('delayInput').value) || 1,
            maxLinks: parseInt(document.getElementById('maxLinksInput').value) || 20,
            maxImages: parseInt(document.getElementById('maxImagesInput').value) || 10,
            textLength: parseInt(document.getElementById('textLengthInput').value) || 1000,
            respectRobots: document.getElementById('respectRobotsInput')?.checked ?? true
        };
    }

    // עדכון UI בזמן גירוד
    updateScrapingUI(isScraping) {
        document.getElementById('startBtn').style.display = isScraping ? 'none' : 'inline-block';
        document.getElementById('stopBtn').style.display = isScraping ? 'inline-block' : 'none';
        document.getElementById('loadingIndicator').style.display = isScraping ? 'block' : 'none';
        
        // נעילת קלטים
        document.getElementById('urlInput').disabled = isScraping;
        const settingInputs = document.querySelectorAll('.setting-item input');
        settingInputs.forEach(input => input.disabled = isScraping);
    }

    // הצגת פס התקדמות
    showProgress() {
        document.getElementById('progressContainer').style.display = 'block';
        this.updateProgress();
    }

    // עדכון פס התקדמות
    updateProgress() {
        const progress = ((this.currentIndex) / this.urls.length) * 100;
        document.getElementById('progressBar').style.width = progress + '%';
        document.getElementById('progressText').textContent = 
            `${Math.round(progress)}% (${this.currentIndex}/${this.urls.length})`;
    }

    // הסתרת פס התקדמות
    hideProgress() {
        document.getElementById('progressContainer').style.display = 'none';
    }

    // עדכון סטטוס URL
    updateUrlStatus(index, status) {
        const statusElement = document.getElementById(`status-${index}`);
        if (statusElement) {
            statusElement.className = `status-indicator status-${status}`;
        }
    }

    // הצגת תוצאות
    displayResults() {
        if (this.results.length === 0) return;

        document.getElementById('resultsContainer').style.display = 'block';
        document.getElementById('exportBtn').style.display = 'inline-block';
        
        this.displayStats();
        this.displayResultsList();
    }

    // הסתרת תוצאות
    hideResults() {
        document.getElementById('resultsContainer').style.display = 'none';
        document.getElementById('exportBtn').style.display = 'none';
    }

    // הצגת סטטיסטיקות
    displayStats() {
        const successful = this.results.filter(r => r.status === 'success').length;
        const failed = this.results.length - successful;
        const avgResponseTime = this.results
            .filter(r => r.responseTime)
            .reduce((sum, r) => sum + r.responseTime, 0) / (successful || 1);

        const totalSize = this.results
            .filter(r => r.pageSize)
            .reduce((sum, r) => sum + r.pageSize, 0);

        document.getElementById('resultsStats').innerHTML = `
            <div class="stat-item">
                <div class="stat-number">${this.results.length}</div>
                <div class="stat-label">סך הכל</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${successful}</div>
                <div class="stat-label">הצליחו</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${failed}</div>
                <div class="stat-label">נכשלו</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${Math.round(avgResponseTime)}ms</div>
                <div class="stat-label">זמן תגובה ממוצע</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${Math.round(totalSize / 1024)}KB</div>
                <div class="stat-label">סך גודל דפים</div>
            </div>
        `;
    }

    // הצגת רשימת תוצאות
    displayResultsList() {
        const resultsList = document.getElementById('resultsList');
        resultsList.innerHTML = '';

        this.results.forEach((result, index) => {
            const resultElement = this.createResultElement(result, index);
            resultsList.appendChild(resultElement);
        });
    }

    // יצירת אלמנט תוצאה
    createResultElement(result, index) {
        const div = document.createElement('div');
        div.className = `result-item ${result.status === 'error' ? 'error' : ''}`;

        if (result.status === 'success') {
            let showFullBtn = '';
            let downloadFullBtn = '';
            if (result.fullHtml) {
                showFullBtn = `<button class="btn btn-secondary" style="margin-bottom:10px; margin-left:8px" onclick="showFullHtml(${index})">הצג דף מלא</button>`;
                downloadFullBtn = `<button class="btn btn-success" style="margin-bottom:10px" onclick="downloadFullHtml(${index})">הורד דף מלא</button>`;
            }
            div.innerHTML = `
                <div class="result-title">${result.title}</div>
                <div class="result-url">${result.url}</div>
                ${showFullBtn}${downloadFullBtn}
                <div class="result-content">
                    <strong>תיאור:</strong> ${result.description || 'ללא תיאור'}<br>
                    <strong>מילות מפתח:</strong> ${result.keywords || 'ללא מילות מפתח'}<br>
                    <strong>סוג תוכן:</strong> ${result.contentType || 'לא ידוע'}<br>
                    <strong>תוכן הדף:</strong><br>
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-top: 5px; max-height: 200px; overflow-y: auto; font-size: 0.9em; line-height: 1.4;">
                        ${result.textContent || 'לא נמצא תוכן טקסט'}
                    </div>
                </div>
                <div class="result-stats">
                    <div class="stat-item">
                        <div class="stat-number">${result.links ? result.links.length : 0}</div>
                        <div class="stat-label">קישורים</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${result.images ? result.images.length : 0}</div>
                        <div class="stat-label">תמונות</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${result.responseTime || 0}ms</div>
                        <div class="stat-label">זמן תגובה</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${Math.round((result.pageSize || 0) / 1024)}KB</div>
                        <div class="stat-label">גודל דף</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${result.statusCode || 'N/A'}</div>
                        <div class="stat-label">קוד HTTP</div>
                    </div>
                </div>
                ${this.createHeadingsSection(result.headings)}
                ${this.createLinksGrid(result.links)}
                ${this.createImagesGrid(result.images)}
            `;
        } else {
            div.innerHTML = `
                <div class="result-title">שגיאה בגירוד</div>
                <div class="result-url">${result.url}</div>
                <div class="result-content">
                    <strong>שגיאה:</strong> ${result.error}
                </div>
            `;
        }

        return div;
    }
// ...existing code...
// פונקציה גלובלית לפתיחת דף מלא בחלון חדש
// יש למקם אותה אחרי סיום המחלקה

    // יצירת סקציית כותרות
    createHeadingsSection(headings) {
        if (!headings || Object.keys(headings).length === 0) return '';

        let headingsHtml = '<div style="margin-top: 15px;"><strong>כותרות בדף:</strong><div style="margin-top: 10px;">';
        
        for (const [level, texts] of Object.entries(headings)) {
            if (texts && texts.length > 0) {
                headingsHtml += `<div style="margin-bottom: 8px;"><strong>${level.toUpperCase()}:</strong> ${texts.slice(0, 3).join(', ')}${texts.length > 3 ? '...' : ''}</div>`;
            }
        }
        
        headingsHtml += '</div></div>';
        return headingsHtml;
    }

    // יצירת רשת קישורים
    createLinksGrid(links) {
        if (!links || links.length === 0) return '';

        const linksHtml = links.slice(0, 12).map(link => 
            `<div class="link-item">
                <a href="${link.url}" target="_blank" title="${link.url}">
                    ${link.text || 'קישור ללא טקסט'}
                </a>
                ${link.isInternal ? '<span style="color: #28a745; font-size: 0.8em;"> (פנימי)</span>' : '<span style="color: #6c757d; font-size: 0.8em;"> (חיצוני)</span>'}
            </div>`
        ).join('');

        return `
            <div style="margin-top: 15px;">
                <strong>קישורים (${Math.min(links.length, 12)} מתוך ${links.length}):</strong>
                <div class="links-grid">${linksHtml}</div>
            </div>
        `;
    }

    // יצירת רשת תמונות  
    createImagesGrid(images) {
        if (!images || images.length === 0) return '';

        const imagesHtml = images.slice(0, 8).map(img => 
            `<div class="link-item">
                <a href="${img.src}" target="_blank">
                    <strong>תמונה:</strong> ${img.alt || img.title || 'ללא תיאור'}
                </a>
                <div style="font-size: 0.8em; color: #6c757d;">
                    ${img.width && img.height ? `${img.width}x${img.height}` : ''}
                </div>
            </div>`
        ).join('');

        return `
            <div style="margin-top: 15px;">
                <strong>תמונות (${Math.min(images.length, 8)} מתוך ${images.length}):</strong>
                <div class="links-grid">${imagesHtml}</div>
            </div>
        `;
    }

    // עזרים
    getDomainFromUrl(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return 'אתר לא ידוע';
        }
    }

    // ייצוא תוצאות
    exportResults() {
        if (this.results.length === 0) {
            this.showToast('אין תוצאות לייצוא', 'error');
            return;
        }

        document.getElementById('exportModal').style.display = 'block';
    }

    // סגירת modal ייצוא
    closeExportModal() {
        document.getElementById('exportModal').style.display = 'none';
        this.selectedExportFormat = null;
        document.querySelectorAll('.export-option').forEach(el => 
            el.classList.remove('selected'));
        document.getElementById('downloadBtn').style.display = 'none';
    }

    // בחירת פורמט ייצוא
    selectExportFormat(format) {
        this.selectedExportFormat = format;
        
        document.querySelectorAll('.export-option').forEach(el => 
            el.classList.remove('selected'));
        event.target.closest('.export-option').classList.add('selected');
        
        document.getElementById('downloadBtn').style.display = 'block';
    }

    // הורדת תוצאות
    downloadResults() {
        if (!this.selectedExportFormat) return;

        let content, filename, mimeType;

        switch (this.selectedExportFormat) {
            case 'json':
                content = JSON.stringify(this.results, null, 2);
                filename = `real-scraping-results-${this.getTimestamp()}.json`;
                mimeType = 'application/json';
                break;
            
            case 'csv':
                content = this.convertToCSV();
                filename = `real-scraping-results-${this.getTimestamp()}.csv`;
                mimeType = 'text/csv;charset=utf-8';
                break;
            
            case 'html':
                content = this.generateHTMLReport();
                filename = `real-scraping-report-${this.getTimestamp()}.html`;
                mimeType = 'text/html;charset=utf-8';
                break;
        }

        this.downloadFile(content, filename, mimeType);
        this.closeExportModal();
        this.showToast('הקובץ הורד בהצלחה!');
    }

    // המרה ל-CSV
    convertToCSV() {
        const headers = ['URL', 'כותרת', 'תיאור', 'מילות מפתח', 'מספר קישורים', 'מספר תמונות', 'זמן תגובה', 'גודל דף', 'קוד HTTP', 'סטטוס', 'תאריך גירוד', 'תוכן טקסט'];
        const csvContent = [
            headers.join(','),
            ...this.results.map(result => [
                `"${result.url}"`,
                `"${(result.title || '').replace(/"/g, '""')}"`,
                `"${(result.description || '').replace(/"/g, '""')}"`,
                `"${(result.keywords || '').replace(/"/g, '""')}"`,
                result.links ? result.links.length : 0,
                result.images ? result.images.length : 0,
                result.responseTime || 0,
                result.pageSize || 0,
                result.statusCode || '',
                result.status,
                `"${result.scrapedAt || ''}"`,
                `"${(result.textContent || '').substring(0, 500).replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n');

        return '\uFEFF' + csvContent; // BOM for Hebrew support
    }

    // יצירת דוח HTML
    generateHTMLReport() {
        const successful = this.results.filter(r => r.status === 'success').length;
        const failed = this.results.length - successful;
        
        return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>דוח גירוד אתרים אמיתי - ${this.getTimestamp()}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; direction: rtl; background: #f5f5f5; }
        .header { background: linear-gradient(45deg, #2a5298, #1e3c72); color: white; padding: 30px; border-radius: 15px; margin-bottom: 30px; text-align: center; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .result { background: white; border-radius: 10px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .result.error { border-right: 5px solid #dc3545; }
        .result.success { border-right: 5px solid #28a745; }
        .result-title { font-size: 1.3em; font-weight: bold; margin-bottom: 10px; color: #2a5298; }
        .result-url { color: #6c757d; margin-bottom: 15px; word-break: break-all; }
        .content-box { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .links { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; margin-top: 15px; }
        .link { background: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 0.9em; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin: 15px 0; }
        .stat-item { text-align: center; background: #e9ecef; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🕷️ דוח גירוד אתרים אמיתי</h1>
        <p>נוצר בתאריך: ${new Date().toLocaleString('he-IL')}</p>
        <p>מופעל על ידי: Real Web Scraper Server</p>
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <h3>${this.results.length}</h3>
            <p>סך הכל אתרים</p>
        </div>
        <div class="stat-card">
            <h3>${successful}</h3>
            <p>הצליחו</p>
        </div>
        <div class="stat-card">
            <h3>${failed}</h3>
            <p>נכשלו</p>
        </div>
        <div class="stat-card">
            <h3>${successful > 0 ? Math.round((successful/this.results.length)*100) : 0}%</h3>
            <p>אחוז הצלחה</p>
        </div>
    </div>
    
    <h2>פירוט תוצאות:</h2>
    ${this.results.map(result => `
        <div class="result ${result.status}">
            <div class="result-title">${result.title || 'שגיאה בגירוד'}</div>
            <div class="result-url">${result.url}</div>
            ${result.status === 'success' ? `
                <div class="content-box">
                    <p><strong>תיאור:</strong> ${result.description || 'ללא תיאור'}</p>
                    <p><strong>מילות מפתח:</strong> ${result.keywords || 'ללא מילות מפתח'}</p>
                    <p><strong>סוג תוכן:</strong> ${result.contentType || 'לא ידוע'}</p>
                </div>
                <div class="stat-grid">
                    <div class="stat-item"><strong>${result.links ? result.links.length : 0}</strong><br>קישורים</div>
                    <div class="stat-item"><strong>${result.images ? result.images.length : 0}</strong><br>תמונות</div>
                    <div class="stat-item"><strong>${result.responseTime || 0}ms</strong><br>זמן תגובה</div>
                    <div class="stat-item"><strong>${Math.round((result.pageSize || 0) / 1024)}KB</strong><br>גודל דף</div>
                    <div class="stat-item"><strong>${result.statusCode || 'N/A'}</strong><br>קוד HTTP</div>
                </div>
                ${result.textContent ? `
                    <div class="content-box">
                        <strong>תוכן הדף:</strong><br>
                        <div style="max-height: 200px; overflow-y: auto; padding: 10px; background: white; border-radius: 5px; margin-top: 10px;">
                            ${result.textContent.substring(0, 1000)}${result.textContent.length > 1000 ? '...' : ''}
                        </div>
                    </div>
                ` : ''}
                ${result.links && result.links.length > 0 ? `
                    <div class="links">
                        ${result.links.slice(0, 15).map(link => 
                            `<div class="link">
                                <a href="${link.url}" target="_blank">${link.text}</a>
                                ${link.isInternal ? '<span style="color: #28a745;"> (פנימי)</span>' : '<span style="color: #6c757d;"> (חיצוני)</span>'}
                            </div>`
                        ).join('')}
                    </div>
                ` : ''}
            ` : `
                <div class="content-box" style="border-right: 3px solid #dc3545;">
                    <p style="color: #dc3545;"><strong>שגיאה:</strong> ${result.error}</p>
                </div>
            `}
        </div>
    `).join('')}
    
    <div style="text-align: center; margin-top: 50px; padding: 20px; background: white; border-radius: 10px;">
        <p>דוח זה נוצר על ידי אפליקציית גירוד אתרים אמיתית</p>
        <p>זמן יצירה: ${new Date().toISOString()}</p>
    </div>
</body>
</html>`;
    }

    // הורדת קובץ
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    // קבלת חותמת זמן
    getTimestamp() {
        return new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
    }

    // הצגת הודעות toast
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }
}

// תפקידי עזר גלובליים (להתחברות מ-HTML)
let app;

// אתחול האפליקציה
document.addEventListener('DOMContentLoaded', () => {
    app = new RealWebScraperApp();
});

// פונקציות גלובליות לקריאה מ-HTML
function addUrl() {
    app.addUrl();
}

function clearUrls() {
    app.clearUrls();
}

function startScraping() {
    app.startScraping();
}

function stopScraping() {
    app.stopScraping();
}

function exportResults() {
    app.exportResults();
}

function closeExportModal() {
    app.closeExportModal();
}

function selectExportFormat(format) {
    app.selectExportFormat(format);
}

function downloadResults() {
    app.downloadResults();
}

// סגירת modal בלחיצה מחוץ לתוכן
window.onclick = function(event) {
    const modal = document.getElementById('exportModal');
    if (event.target === modal) {
        app.closeExportModal();
    }
}