// אפליקציית גירוד אתרים - JavaScript
class WebScraperApp {
    constructor() {
        this.urls = [];
        this.results = [];
        this.isScraping = false;
        this.currentIndex = 0;
        this.selectedExportFormat = null;
        this.init();
    }

    init() {
        // האזנה ל-Enter בשדה הקלט
        document.getElementById('urlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addUrl();
            }
        });
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

    // התחלת גירוד
    async startScraping() {
        if (this.urls.length === 0) {
            this.showToast('אנא הוסף לפחות אתר אחד לגירוד', 'error');
            return;
        }

        if (this.isScraping) {
            this.showToast('גירוד כבר מתבצע', 'error');
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
            for (let i = 0; i < this.urls.length; i++) {
                if (!this.isScraping) break; // אם המשתמש עצר
                
                this.currentIndex = i;
                this.updateProgress();
                this.updateUrlStatus(i, 'pending');
                
                const result = await this.scrapeUrl(this.urls[i], settings);
                this.results.push(result);
                
                this.updateUrlStatus(i, result.status);
                this.updateProgress();
                
                // השהיה בין בקשות
                if (i < this.urls.length - 1) {
                    await this.delay(settings.delay * 1000);
                }
            }
            
            this.showToast('גירוד הושלם בהצלחה!');
            this.displayResults();
            
        } catch (error) {
            this.showToast('שגיאה בגירוד: ' + error.message, 'error');
        } finally {
            this.updateScrapingUI(false);
            this.hideProgress();
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

    // גירוד URL יחיד (סימולציה - בפועל יצטרך שרת)
    async scrapeUrl(url, settings) {
        try {
            // סימולציה של בקשת HTTP
            const response = await this.simulateHttpRequest(url, settings);
            
            return {
                url: url,
                title: response.title,
                description: response.description,
                headings: response.headings,
                links: response.links.slice(0, settings.maxLinks),
                images: response.images.slice(0, settings.maxImages),
                textContent: response.textContent.substring(0, settings.textLength),
                scrapedAt: new Date().toISOString(),
                status: 'success',
                responseTime: response.responseTime,
                pageSize: response.pageSize
            };
        } catch (error) {
            return {
                url: url,
                error: error.message,
                scrapedAt: new Date().toISOString(),
                status: 'error'
            };
        }
    }

    // סימולציה של בקשת HTTP (במציאות צריך שרת או CORS proxy)
    async simulateHttpRequest(url, settings) {
        // סימולציה של זמן תגובה
        await this.delay(Math.random() * 2000 + 500);
        
        // ייצור נתונים מדומים לדוגמה
        const mockData = {
            title: `כותרת הדף של ${this.getDomainFromUrl(url)}`,
            description: `תיאור הדף של ${url}`,
            headings: {
                h1: [`כותרת ראשית של ${this.getDomainFromUrl(url)}`],
                h2: ['כותרת משנה 1', 'כותרת משנה 2']
            },
            links: this.generateMockLinks(url, 25),
            images: this.generateMockImages(url, 15),
            textContent: this.generateMockText(url),
            responseTime: Math.floor(Math.random() * 1000 + 200),
            pageSize: Math.floor(Math.random() * 50000 + 10000)
        };

        // סימולציה של כשל אקראי (10% סיכוי)
        if (Math.random() < 0.1) {
            throw new Error('Connection timeout');
        }

        return mockData;
    }

    // עזרים לייצור נתונים מדומים
    getDomainFromUrl(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return 'אתר לא ידוע';
        }
    }

    generateMockLinks(baseUrl, count) {
        const links = [];
        const domain = this.getDomainFromUrl(baseUrl);
        
        for (let i = 0; i < count; i++) {
            links.push({
                text: `קישור ${i + 1} מ-${domain}`,
                url: `${baseUrl}/page-${i + 1}`,
                isInternal: Math.random() > 0.3
            });
        }
        
        return links;
    }

    generateMockImages(baseUrl, count) {
        const images = [];
        const domain = this.getDomainFromUrl(baseUrl);
        
        for (let i = 0; i < count; i++) {
            images.push({
                src: `${baseUrl}/images/image-${i + 1}.jpg`,
                alt: `תמונה ${i + 1} מ-${domain}`,
                title: `כותרת תמונה ${i + 1}`
            });
        }
        
        return images;
    }

    generateMockText(url) {
        const domain = this.getDomainFromUrl(url);
        return `זהו תוכן הטקסט של הדף מהאתר ${domain}. כאן יופיע התוכן האמיתי של הדף לאחר גירוד. ` +
               `הטקסט כולל מידע על הנושא העיקרי של הדף, כמו גם פרטים נוספים שיכולים להיות שימושיים למשתמש. ` +
               `ניתן לראות כאן את האופן שבו הטקסט מעובד ומוצג במערכת הגירוד.`.repeat(3);
    }

    // קבלת הגדרות מהטופס
    getSettings() {
        return {
            delay: parseFloat(document.getElementById('delayInput').value) || 1,
            maxLinks: parseInt(document.getElementById('maxLinksInput').value) || 20,
            maxImages: parseInt(document.getElementById('maxImagesInput').value) || 10,
            textLength: parseInt(document.getElementById('textLengthInput').value) || 1000
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

    // הסת××ת תוצאות
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
            .reduce((sum, r) => sum + r.responseTime, 0) / successful || 0;

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
            div.innerHTML = `
                <div class="result-title">${result.title}</div>
                <div class="result-url">${result.url}</div>
                <div class="result-content">
                    <strong>תיאור:</strong> ${result.description}<br>
                    <strong>תוכן:</strong> ${result.textContent.substring(0, 200)}...
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
                        <div class="stat-number">${result.responseTime}ms</div>
                        <div class="stat-label">זמן תגובה</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${Math.round(result.pageSize / 1024)}KB</div>
                        <div class="stat-label">גודל דף</div>
                    </div>
                </div>
                ${this.createLinksGrid(result.links)}
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

    // יצירת רשת קישורים
    createLinksGrid(links) {
        if (!links || links.length === 0) return '';

        const linksHtml = links.slice(0, 10).map(link => 
            `<div class="link-item">
                <a href="${link.url}" target="_blank" title="${link.url}">
                    ${link.text || 'קישור ללא טקסט'}
                </a>
            </div>`
        ).join('');

        return `
            <div style="margin-top: 15px;">
                <strong>קישורים (${Math.min(links.length, 10)} מתוך ${links.length}):</strong>
                <div class="links-grid">${linksHtml}</div>
            </div>
        `;
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
                filename = `scraping-results-${this.getTimestamp()}.json`;
                mimeType = 'application/json';
                break;
            
            case 'csv':
                content = this.convertToCSV();
                filename = `scraping-results-${this.getTimestamp()}.csv`;
                mimeType = 'text/csv;charset=utf-8';
                break;
            
            case 'html':
                content = this.generateHTMLReport();
                filename = `scraping-report-${this.getTimestamp()}.html`;
                mimeType = 'text/html;charset=utf-8';
                break;
        }

        this.downloadFile(content, filename, mimeType);
        this.closeExportModal();
        this.showToast('הקובץ הורד בהצלחה!');
    }

    // המרה ל-CSV
    convertToCSV() {
        const headers = ['URL', 'כותרת', 'תיאור', 'מספר קישורים', 'מספר תמונות', 'זמן תגובה', 'סטטוס', 'תאריך גירוד'];
        const csvContent = [
            headers.join(','),
            ...this.results.map(result => [
                `"${result.url}"`,
                `"${result.title || ''}"`,
                `"${result.description || ''}"`,
                result.links ? result.links.length : 0,
                result.images ? result.images.length : 0,
                result.responseTime || 0,
                result.status,
                `"${result.scrapedAt || ''}"`
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
    <title>דוח גירוד אתרים - ${this.getTimestamp()}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; direction: rtl; }
        .header { background: #2a5298; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #e1e5e9; }
        .result { background: white; border: 1px solid #e1e5e9; border-radius: 8px; padding: 20px; margin-bottom: 15px; }
        .result.error { border-right: 5px solid #dc3545; }
        .result.success { border-right: 5px solid #28a745; }
        .result-title { font-size: 1.2em; font-weight: bold; margin-bottom: 10px; }
        .result-url { color: #6c757d; margin-bottom: 15px; word-break: break-all; }
        .links { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; margin-top: 15px; }
        .link { background: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🕷️ דוח גירוד אתרים</h1>
        <p>נוצר בתאריך: ${new Date().toLocaleString('he-IL')}</p>
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
            <h3>${Math.round((successful/this.results.length)*100)}%</h3>
            <p>אחוז הצלחה</p>
        </div>
    </div>
    
    <h2>פירוט תוצאות:</h2>
    ${this.results.map(result => `
        <div class="result ${result.status}">
            <div class="result-title">${result.title || 'שגיאה בגירוד'}</div>
            <div class="result-url">${result.url}</div>
            ${result.status === 'success' ? `
                <p><strong>תיאור:</strong> ${result.description}</p>
                <p><strong>קישורים:</strong> ${result.links ? result.links.length : 0} | 
                   <strong>תמונות:</strong> ${result.images ? result.images.length : 0} | 
                   <strong>זמן תגובה:</strong> ${result.responseTime}ms</p>
                ${result.links && result.links.length > 0 ? `
                    <div class="links">
                        ${result.links.slice(0, 10).map(link => 
                            `<div class="link"><a href="${link.url}" target="_blank">${link.text}</a></div>`
                        ).join('')}
                    </div>
                ` : ''}
            ` : `
                <p style="color: #dc3545;"><strong>שגיאה:</strong> ${result.error}</p>
            `}
        </div>
    `).join('')}
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

    // השהיה
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // הצגת הודעות toast
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// תפקידי עזר גלובליים (להתחברות מ-HTML)
let app;

// אתחול האפליקציה
document.addEventListener('DOMContentLoaded', () => {
    app = new WebScraperApp();
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