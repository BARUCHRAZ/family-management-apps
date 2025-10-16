/**
 * Google Drive API Configuration
 * מלא את הפרטים שקיבלת מ-Google Cloud Console
 */

const GOOGLE_DRIVE_CONFIG = {
    // מלא כאן את ה-API Key שקיבלת
    apiKey: 'AIzaSyDYWD82Sl1yQ64ZezlfiblpKD_f4B91IYk',
    
    // מלא כאן את ה-Client ID שקיבלת  
    clientId: '990496616929-01ikleujijmpcgiks6kt455ciauf3ksn.apps.googleusercontent.com',
    
    // הגדרות נוספות
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    scope: 'https://www.googleapis.com/auth/drive.file',
    
    // שם התיקייה ב-Drive
    appFolderName: 'FamilyApps'
};

// בדיקה שכל הפרטים מולאו
function validateConfig() {
    const requiredFields = ['apiKey', 'clientId'];
    const missing = requiredFields.filter(field => 
        !GOOGLE_DRIVE_CONFIG[field] || 
        GOOGLE_DRIVE_CONFIG[field].includes('YOUR_')
    );
    
    if (missing.length > 0) {
        console.error('❌ חסרים פרטי API:', missing);
        console.log('📝 עדכן את הקובץ config.js עם הפרטים מ-Google Cloud Console');
        return false;
    }
    
    console.log('✅ הגדרות Google Drive תקינות');
    return true;
}

// יצוא ההגדרות
window.GOOGLE_DRIVE_CONFIG = GOOGLE_DRIVE_CONFIG;
window.validateConfig = validateConfig;