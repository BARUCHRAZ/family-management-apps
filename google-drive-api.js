/**
 * Google Drive API Integration
 * מחליף את Firebase עם Google Drive כבסיס נתונים
 */

class GoogleDriveDB {
    constructor() {
        this.isSignedIn = false;
        this.appFolder = 'FamilyApps';
        this.init();
    }

    // אתחול Google Drive API
    async init() {
        try {
            await this.loadGoogleAPI();
            await gapi.load('auth2', this.initAuth.bind(this));
            await gapi.load('client', this.initClient.bind(this));
            console.log('✅ Google Drive API מוכן לשימוש');
        } catch (error) {
            console.error('❌ שגיאה באתחול Google Drive:', error);
            this.fallbackToLocalStorage();
        }
    }

    // טעינת Google API
    loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            if (typeof gapi !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // אתחול מערכת האימות
    async initAuth() {
        try {
            this.auth2 = await gapi.auth2.init({
                client_id: 'YOUR_CLIENT_ID.googleusercontent.com', // צריך להחליף!
                scope: 'https://www.googleapis.com/auth/drive.file'
            });
            
            this.isSignedIn = this.auth2.isSignedIn.get();
            console.log('🔐 מערכת אימות Google מוכנה');
            
            if (!this.isSignedIn) {
                await this.signIn();
            }
        } catch (error) {
            console.error('❌ שגיאה באימות:', error);
        }
    }

    // אתחול Google Drive Client
    async initClient() {
        await gapi.client.init({
            apiKey: 'YOUR_API_KEY', // צריך להחליף!
            clientId: 'YOUR_CLIENT_ID.googleusercontent.com',
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            scope: 'https://www.googleapis.com/auth/drive.file'
        });
        console.log('🔧 Google Drive Client מוכן');
    }

    // התחברות ל-Google
    async signIn() {
        try {
            await this.auth2.signIn();
            this.isSignedIn = true;
            console.log('✅ התחברת בהצלחה ל-Google Drive');
            await this.ensureAppFolder();
        } catch (error) {
            console.error('❌ כישלון בהתחברות:', error);
            this.fallbackToLocalStorage();
        }
    }

    // יצירת תיקיית האפליקציה אם לא קיימת
    async ensureAppFolder() {
        try {
            // חיפוש תיקיית האפליקציה
            const response = await gapi.client.drive.files.list({
                q: `name='${this.appFolder}' and mimeType='application/vnd.google-apps.folder'`,
                spaces: 'drive'
            });

            if (response.result.files.length === 0) {
                // יצירת התיקייה
                await gapi.client.drive.files.create({
                    resource: {
                        name: this.appFolder,
                        mimeType: 'application/vnd.google-apps.folder'
                    }
                });
                console.log('📁 תיקיית האפליקציה נוצרה');
            } else {
                console.log('📁 תיקיית האפליקציה נמצאה');
            }
        } catch (error) {
            console.error('❌ שגיאה ביצירת תיקייה:', error);
        }
    }

    // שמירת נתונים ב-Google Drive
    async saveData(filename, data) {
        if (!this.isSignedIn) {
            console.warn('⚠️ לא מחובר - שומר ב-LocalStorage');
            return this.saveToLocalStorage(filename, data);
        }

        try {
            const jsonData = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });

            // חיפוש קובץ קיים
            const searchResponse = await gapi.client.drive.files.list({
                q: `name='${filename}' and parents in '${await this.getFolderId()}'`
            });

            let fileId = null;
            if (searchResponse.result.files.length > 0) {
                fileId = searchResponse.result.files[0].id;
            }

            // יצירת FormData להעלאה
            const metadata = {
                name: filename,
                parents: [await this.getFolderId()]
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            // העלאה או עדכון
            const url = fileId 
                ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
                : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

            const response = await fetch(url, {
                method: fileId ? 'PATCH' : 'POST',
                headers: {
                    'Authorization': `Bearer ${gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token}`
                },
                body: form
            });

            if (response.ok) {
                console.log(`✅ ${filename} נשמר ב-Google Drive`);
                // גיבוי ב-LocalStorage
                this.saveToLocalStorage(filename, data);
                return true;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }

        } catch (error) {
            console.error(`❌ שגיאה בשמירת ${filename}:`, error);
            // Fallback ל-LocalStorage
            return this.saveToLocalStorage(filename, data);
        }
    }

    // טעינת נתונים מ-Google Drive
    async loadData(filename) {
        if (!this.isSignedIn) {
            console.warn('⚠️ לא מחובר - טוען מ-LocalStorage');
            return this.loadFromLocalStorage(filename);
        }

        try {
            // חיפוש הקובץ
            const searchResponse = await gapi.client.drive.files.list({
                q: `name='${filename}' and parents in '${await this.getFolderId()}'`
            });

            if (searchResponse.result.files.length === 0) {
                console.log(`📄 ${filename} לא נמצא ב-Drive - טוען מ-LocalStorage`);
                return this.loadFromLocalStorage(filename);
            }

            const fileId = searchResponse.result.files[0].id;
            
            // הורדת תוכן הקובץ
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: {
                    'Authorization': `Bearer ${gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token}`
                }
            });

            if (response.ok) {
                const jsonData = await response.text();
                const data = JSON.parse(jsonData);
                console.log(`✅ ${filename} נטען מ-Google Drive`);
                
                // עדכון גיבוי ב-LocalStorage
                this.saveToLocalStorage(filename, data);
                return data;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }

        } catch (error) {
            console.error(`❌ שגיאה בטעינת ${filename}:`, error);
            return this.loadFromLocalStorage(filename);
        }
    }

    // קבלת ID של תיקיית האפליקציה
    async getFolderId() {
        if (this.folderId) return this.folderId;

        const response = await gapi.client.drive.files.list({
            q: `name='${this.appFolder}' and mimeType='application/vnd.google-apps.folder'`,
            spaces: 'drive'
        });

        if (response.result.files.length > 0) {
            this.folderId = response.result.files[0].id;
            return this.folderId;
        }

        throw new Error('תיקיית האפליקציה לא נמצאה');
    }

    // גיבוי ב-LocalStorage
    saveToLocalStorage(filename, data) {
        try {
            const key = `familyApps_${filename}`;
            const dataWithTimestamp = {
                data: data,
                timestamp: Date.now(),
                source: 'localStorage'
            };
            localStorage.setItem(key, JSON.stringify(dataWithTimestamp));
            console.log(`💾 ${filename} נשמר ב-LocalStorage`);
            return true;
        } catch (error) {
            console.error(`❌ שגיאה בשמירה ב-LocalStorage:`, error);
            return false;
        }
    }

    // טעינה מ-LocalStorage
    loadFromLocalStorage(filename) {
        try {
            const key = `familyApps_${filename}`;
            const stored = localStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                console.log(`💾 ${filename} נטען מ-LocalStorage`);
                return parsed.data;
            }
            return null;
        } catch (error) {
            console.error(`❌ שגיאה בטעינה מ-LocalStorage:`, error);
            return null;
        }
    }

    // Fallback למקרה שGoogle Drive לא עובד
    fallbackToLocalStorage() {
        console.warn('⚠️ עובר למצב LocalStorage בלבד');
        this.isSignedIn = false;
        
        // החלפת הפונקציות לLocalStorage בלבד
        this.saveData = this.saveToLocalStorage;
        this.loadData = this.loadFromLocalStorage;
    }

    // סטטוס החיבור
    getStatus() {
        return {
            connected: this.isSignedIn,
            storage: this.isSignedIn ? 'Google Drive + LocalStorage' : 'LocalStorage בלבד',
            folderName: this.appFolder
        };
    }

    // יצירת גיבוי ידני
    async createBackup() {
        const timestamp = new Date().toISOString().split('T')[0];
        const backupFiles = ['books.json', 'savings.json', 'scholarships.json'];
        
        for (const filename of backupFiles) {
            const data = await this.loadData(filename);
            if (data) {
                const backupFilename = `backup_${timestamp}_${filename}`;
                await this.saveData(backupFilename, data);
            }
        }
        
        console.log('✅ גיבוי הושלם');
    }

    // רשימת כל הקבצים באפליקציה
    async listFiles() {
        if (!this.isSignedIn) {
            console.warn('⚠️ צריך להיות מחובר כדי לראות רשימת קבצים');
            return [];
        }

        try {
            const response = await gapi.client.drive.files.list({
                q: `parents in '${await this.getFolderId()}'`,
                fields: 'files(id, name, modifiedTime, size)'
            });

            return response.result.files;
        } catch (error) {
            console.error('❌ שגיאה בקבלת רשימת קבצים:', error);
            return [];
        }
    }
}

// יצוא לשימוש גלובלי
window.GoogleDriveDB = GoogleDriveDB;

console.log('🔧 Google Drive API מוכן לשימוש!');
console.log('📖 להתחיל: const db = new GoogleDriveDB();');