// טעינת ספריית html2pdf.js
(function() {
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = function() {
        window.html2pdfLoaded = true;
    };
    document.head.appendChild(script);
})();

// הוספת פונקציה לייצוא PDF
function downloadResultsPDF() {
    if (!window.html2pdfLoaded) {
        app.showToast('הספריה ל-PDF עדיין נטענת, נסה שוב בעוד רגע', 'error');
        return;
    }
    if (!app || !app.results || app.results.length === 0) {
        app.showToast('אין תוצאות לייצוא', 'error');
        return;
    }

    // בנה DOM אמיתי ולא HTML שלם (html2pdf לא תומך ב-html מלא)
    var tempDiv = document.createElement('div');
    tempDiv.style.background = '#fff';
    tempDiv.style.padding = '20px';
    tempDiv.style.margin = '0 auto';
    tempDiv.style.width = '100%';
    tempDiv.style.maxWidth = '900px';
    tempDiv.style.direction = 'rtl';
    tempDiv.style.fontFamily = 'Arial, sans-serif';

    var h1 = document.createElement('h1');
    h1.textContent = '🕷️ דוח גירוד אתרים';
    h1.style.textAlign = 'center';
    h1.style.color = '#2a5298';
    tempDiv.appendChild(h1);

    var p = document.createElement('p');
    p.textContent = 'נוצר בתאריך: ' + new Date().toLocaleString('he-IL');
    p.style.textAlign = 'center';
    tempDiv.appendChild(p);

    // נטען את כל התמונות ל-dataURL לפני יצירת PDF
    const createResultDivs = () => {
        app.results.forEach(function(result) {
            var resultDiv = document.createElement('div');
            resultDiv.className = 'result';
            resultDiv.style.borderBottom = '1px solid #ccc';
            resultDiv.style.marginBottom = '30px';
            resultDiv.style.paddingBottom = '20px';

            var title = document.createElement('div');
            title.className = 'result-title';
            title.textContent = result.title || 'ללא כותרת';
            title.style.fontWeight = 'bold';
            title.style.fontSize = '1.2em';
            title.style.color = '#2a5298';
            title.style.marginBottom = '5px';
            resultDiv.appendChild(title);

            var url = document.createElement('div');
            url.className = 'result-url';
            url.textContent = result.url;
            url.style.color = '#6c757d';
            url.style.marginBottom = '10px';
            url.style.wordBreak = 'break-all';
            resultDiv.appendChild(url);

            if(result.status === 'success') {
                var content = document.createElement('div');
                content.className = 'result-content';
                content.innerHTML = '<strong>תיאור:</strong> ' + (result.description || '---') + '<br>' +
                    '<strong>מילות מפתח:</strong> ' + (result.keywords || '---') + '<br>' +
                    '<strong>סוג תוכן:</strong> ' + (result.contentType || '---') + '<br>';
                content.style.marginBottom = '10px';
                resultDiv.appendChild(content);

                var text = document.createElement('div');
                text.className = 'result-text';
                text.innerHTML = '<strong>תוכן הדף:</strong><br>' + (result.textContent ? result.textContent.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '---');
                text.style.background = '#f8f9fa';
                text.style.padding = '10px';
                text.style.borderRadius = '5px';
                text.style.marginTop = '5px';
                text.style.fontSize = '0.95em';
                text.style.lineHeight = '1.5';
                text.style.maxHeight = '400px';
                text.style.overflowY = 'auto';
                resultDiv.appendChild(text);

                if(result.images && result.images.length > 0) {
                    var imagesDiv = document.createElement('div');
                    imagesDiv.className = 'result-images';
                    imagesDiv.style.display = 'flex';
                    imagesDiv.style.flexWrap = 'wrap';
                    imagesDiv.style.gap = '10px';
                    imagesDiv.style.marginTop = '10px';
                    result.images.forEach(function(img) {
                        if(img.src) {
                            var imgWrap = document.createElement('div');
                            var imageEl = document.createElement('img');
                            imageEl.alt = img.alt || '';
                            imageEl.title = img.title || '';
                            imageEl.style.maxWidth = '180px';
                            imageEl.style.maxHeight = '120px';
                            imageEl.style.borderRadius = '6px';
                            imageEl.style.border = '1px solid #eee';
                            imageEl.style.background = '#fafafa';
                            imageEl.src = img.src;
                            var caption = document.createElement('div');
                            caption.style.fontSize = '0.8em';
                            caption.style.textAlign = 'center';
                            caption.textContent = img.alt || img.title || '';
                            imgWrap.appendChild(imageEl);
                            imgWrap.appendChild(caption);
                            imagesDiv.appendChild(imgWrap);
                        }
                    });
                    resultDiv.appendChild(imagesDiv);
                }
            } else {
                var err = document.createElement('div');
                err.className = 'result-content';
                err.style.color = '#dc3545';
                err.innerHTML = '<strong>שגיאה:</strong> ' + (result.error || '---');
                resultDiv.appendChild(err);
            }
            tempDiv.appendChild(resultDiv);
        });
    };

    // פונקציה שמחזירה הבטחה שכל התמונות נטענו ל-dataURL (CORS: רק תמונות מאותו דומיין או data:)
    function preloadAllImages() {
        const promises = [];
        app.results.forEach(function(result) {
            if(result.status === 'success' && result.images && result.images.length > 0) {
                result.images.forEach(function(img) {
                    if(img.src && !img.src.startsWith('data:')) {
                        promises.push(new Promise(function(resolve) {
                            var tempImage = new window.Image();
                            tempImage.crossOrigin = 'anonymous';
                            tempImage.onload = function() {
                                try {
                                    var canvas = document.createElement('canvas');
                                    canvas.width = tempImage.naturalWidth;
                                    canvas.height = tempImage.naturalHeight;
                                    var ctx = canvas.getContext('2d');
                                    ctx.drawImage(tempImage, 0, 0);
                                    img.src = canvas.toDataURL('image/jpeg', 0.95);
                                } catch(e) {}
                                resolve();
                            };
                            tempImage.onerror = function() { resolve(); };
                            tempImage.src = img.src;
                        }));
                    }
                });
            }
        });
        return Promise.all(promises);
    }

    // ייצוא כל הדף כפי שהוא מוצג (כולל עיצוב, תמונות, טקסט וכו')
    var container = document.querySelector('.container');
    if (!container) {
        app.showToast('לא נמצא אלמנט .container לייצוא', 'error');
        return;
    }
    var opt = {
        margin:       0.2,
        filename:     'scraping-fullpage-' + app.getTimestamp() + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(container).save();

    var footer = document.createElement('div');
    footer.style.textAlign = 'center';
    footer.style.marginTop = '40px';
    footer.style.color = '#888';
    footer.textContent = 'דוח זה נוצר על ידי אפליקציית גירוד אתרים';
    tempDiv.appendChild(footer);

    document.body.appendChild(tempDiv);

    var opt = {
        margin:       0.5,
        filename:     'scraping-report-' + app.getTimestamp() + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(tempDiv).save().then(function() {
        document.body.removeChild(tempDiv);
    }).catch(function() {
        document.body.removeChild(tempDiv);
        app.showToast('שגיאה ביצירת PDF', 'error');
    });
}