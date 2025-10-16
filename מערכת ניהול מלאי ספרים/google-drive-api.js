/**
 * Google Drive API Integration for Books Management
 * מחליף את Firebase עם Google Drive
 */

class GoogleDriveAPI {
    constructor() {
        this.isInitialized = false;
        this.isSignedIn = false;
        this.appFolderId = null;
        console.log('🔧 יוצר חיבור Google Drive...');
    }

    // אתחול ה-API
    async initialize() {
        try {
            console.log('🚀 מאתחל Google Drive API...');
            
            // בדיקת הגדרות
            if (!validateConfig()) {
                throw new Error('הגדרות API לא תקינות');
            }

            // טעינת Google API
            await this.loadGoogleAPI();
            
            // אתחול gapi
            await new Promise((resolve) => {
                gapi.load('client:auth2', resolve);
            });

            // הגדרת הclient
            await gapi.client.init({
                apiKey: GOOGLE_DRIVE_CONFIG.apiKey,
                clientId: GOOGLE_DRIVE_CONFIG.clientId,
                discoveryDocs: GOOGLE_DRIVE_CONFIG.discoveryDocs,
                scope: GOOGLE_DRIVE_CONFIG.scope
            });

            // קבלת מצב ההתחברות
            this.authInstance = gapi.auth2.getAuthInstance();
            this.isSignedIn = this.authInstance.isSignedIn.get();

            this.isInitialized = true;
            console.log('✅ Google Drive API מוכן!');
            
            // אם לא מחובר, נציע התחברות
            if (!this.isSignedIn) {
                console.log('🔐 צריך להתחבר ל-Google Drive');
                await this.signIn();
            } else {
                console.log('✅ כבר מחובר ל-Google Drive');
                await this.ensureAppFolder();
            }

            return true;

        } catch (error) {
            console.error('❌ שגיאה באתחול Google Drive:', error);
            this.isInitialized = false;
            return false;
        }
    }

    // טעינת Google API Script
    loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            if (typeof gapi !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                console.log('📦 Google API נטען');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ לא ניתן לטעון Google API');
                reject(new Error('טעינת Google API נכשלה'));
            };
            document.head.appendChild(script);
        });
    }

    // התחברות ל-Google
    async signIn() {
        try {
            console.log('🔐 מתחבר ל-Google Drive...');
            await this.authInstance.signIn();
            this.isSignedIn = true;
            console.log('✅ התחברות הצליחה!');
            
            await this.ensureAppFolder();
            return true;

        } catch (error) {
            console.error('❌ התחברות נכשלה:', error);
            return false;
        }
    }

    // התנתקות מGoogle
    async signOut() {
        try {
            await this.authInstance.signOut();
            this.isSignedIn = false;
            this.appFolderId = null;
            console.log('🚪 התנתקת מ-Google Drive');
        } catch (error) {
            console.error('❌ שגיאה בהתנתקות:', error);
        }
    }

    // יצירת תיקיית האפליקציה
    async ensureAppFolder() {
        try {
            console.log('📁 בודק תיקיית האפליקציה...');
            
            // חיפוש תיקייה קיימת
            const response = await gapi.client.drive.files.list({
                q: `name='${GOOGLE_DRIVE_CONFIG.appFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                spaces: 'drive'
            });

            if (response.result.files.length > 0) {
                this.appFolderId = response.result.files[0].id;
                console.log('✅ תיקיית האפליקציה נמצאה:', this.appFolderId);
            } else {
                // יצירת תיקייה חדשה
                console.log('📁 יוצר תיקיית אפליקציה חדשה...');
                const createResponse = await gapi.client.drive.files.create({
                    resource: {
                        name: GOOGLE_DRIVE_CONFIG.appFolderName,
                        mimeType: 'application/vnd.google-apps.folder'
                    }
                });
                
                this.appFolderId = createResponse.result.id;
                console.log('✅ תיקייה נוצרה:', this.appFolderId);
            }

        } catch (error) {
            console.error('❌ שגיאה ביצירת תיקייה:', error);
            throw error;
        }
    }

    // שמירת קובץ ב-Drive
    async saveFile(filename, data) {
        if (!this.isSignedIn || !this.appFolderId) {
            throw new Error('לא מחובר ל-Google Drive');
        }

        try {
            console.log(`💾 שומר ${filename}...`);
            
            const jsonData = JSON.stringify(data, null, 2);
            
            // חיפוש קובץ קיים
            const searchResponse = await gapi.client.drive.files.list({
                q: `name='${filename}' and parents in '${this.appFolderId}' and trashed=false`
            });

            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";

            const metadata = {
                name: filename,
                parents: [this.appFolderId]
            };

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                jsonData +
                close_delim;

            let request;
            if (searchResponse.result.files.length > 0) {
                // עדכון קובץ קיים
                const fileId = searchResponse.result.files[0].id;
                request = gapi.client.request({
                    path: `https://www.googleapis.com/upload/drive/v3/files/${fileId}`,
                    method: 'PATCH',
                    params: { uploadType: 'multipart' },
                    headers: {
                        'Content-Type': `multipart/related; boundary="${boundary}"`
                    },
                    body: multipartRequestBody
                });
            } else {
                // יצירת קובץ חדש
                request = gapi.client.request({
                    path: 'https://www.googleapis.com/upload/drive/v3/files',
                    method: 'POST',
                    params: { uploadType: 'multipart' },
                    headers: {
                        'Content-Type': `multipart/related; boundary="${boundary}"`
                    },
                    body: multipartRequestBody
                });
            }

            await request;
            console.log(`✅ ${filename} נשמר ב-Google Drive`);
            return true;

        } catch (error) {
            console.error(`❌ שגיאה בשמירת ${filename}:`, error);
            throw error;
        }
    }

    // טעינת קובץ מ-Drive
    async loadFile(filename) {
        if (!this.isSignedIn || !this.appFolderId) {
            throw new Error('לא מחובר ל-Google Drive');
        }

        try {
            console.log(`📂 טוען ${filename}...`);
            
            // חיפוש הקובץ
            const searchResponse = await gapi.client.drive.files.list({
                q: `name='${filename}' and parents in '${this.appFolderId}' and trashed=false`
            });

            if (searchResponse.result.files.length === 0) {
                console.log(`📄 ${filename} לא נמצא`);
                return null;
            }

            const fileId = searchResponse.result.files[0].id;
            
            // הורדת תוכן הקובץ
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });

            const data = JSON.parse(response.body);
            console.log(`✅ ${filename} נטען מ-Google Drive`);
            return data;

        } catch (error) {
            console.error(`❌ שגיאה בטעינת ${filename}:`, error);
            throw error;
        }
    }

    // רשימת קבצים בתיקייה
    async listFiles() {
        if (!this.isSignedIn || !this.appFolderId) {
            return [];
        }

        try {
            const response = await gapi.client.drive.files.list({
                q: `parents in '${this.appFolderId}' and trashed=false`,
                fields: 'files(id, name, modifiedTime, size)'
            });

            return response.result.files;
        } catch (error) {
            console.error('❌ שגיאה בקבלת רשימת קבצים:', error);
            return [];
        }
    }

    // בדיקת סטטוס
    getStatus() {
        return {
            initialized: this.isInitialized,
            signedIn: this.isSignedIn,
            appFolderId: this.appFolderId,
            folderName: GOOGLE_DRIVE_CONFIG.appFolderName
        };
    }

    // יצירת גיבוי עם חותמת זמן
    async createBackup(filename, data) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFilename = `backup_${timestamp}_${filename}`;
        return await this.saveFile(backupFilename, data);
    }
}

// יצוא לשימוש גלובלי
window.GoogleDriveAPI = GoogleDriveAPI;

console.log('🔧 Google Drive API Wrapper מוכן!');