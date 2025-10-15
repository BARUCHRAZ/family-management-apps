// Firebase Configuration - קונפיגורציה משותפת לכל האפליקציות
// עליכם להחליף את הערכים האלה בערכים האמיתיים מהפרויקט Firebase שלכם

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';

// הגדרות Firebase - הנתונים האמיתיים מהפרויקט שלך
const firebaseConfig = {
  apiKey: "AIzaSyA8I2Idfnn1hupCZhiy1n4UaYgDJg58WKs",
  authDomain: "family-apps-2025.firebaseapp.com",
  projectId: "family-apps-2025",
  storageBucket: "family-apps-2025.firebasestorage.app",
  messagingSenderId: "540487800973",
  appId: "1:540487800973:web:825257708f0218a053aac4"
};

// אתחול Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ייצוא למודולים אחרים
export { db, auth };

// פונקציית עזר לטיפול בשגיאות Firebase
export function handleFirebaseError(error) {
  console.error('Firebase Error:', error);
  
  const errorMessages = {
    'permission-denied': 'אין לך הרשאה לבצע פעולה זו',
    'unavailable': 'השירות לא זמין כרגע, נסה שוב מאוחר יותר',
    'failed-precondition': 'הפעולה נכשלה בגלל תנאי מוקדם',
    'not-found': 'המסמך לא נמצא',
    'already-exists': 'המסמך כבר קיים',
    'resource-exhausted': 'חרגת ממכסה השימוש',
    'unauthenticated': 'נדרש אימות משתמש'
  };
  
  return errorMessages[error.code] || `שגיאה: ${error.message}`;
}

// פונקציה לבדיקת חיבור לאינטרנט ו-Firebase
let firebaseBlocked = false;

export function checkOnlineStatus() {
  // אם Firebase חסום על ידי NetFree, עבור למצב אופליין
  if (firebaseBlocked) {
    console.log('🚫 Firebase blocked by NetFree - working offline');
    return false;
  }
  
  return navigator.onLine;
}

// פונקציה לסימון שFirebase חסום
export function markFirebaseBlocked() {
  firebaseBlocked = true;
  console.log('🚫 Firebase marked as blocked - switching to offline mode');
}

// פונקציה לטיפול במצב אופליין
export function handleOfflineMode() {
  if (!checkOnlineStatus()) {
    const offlineMessage = document.createElement('div');
    offlineMessage.id = 'offline-banner';
    offlineMessage.className = 'fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-2 z-50';
    offlineMessage.innerHTML = '⚠️ אין חיבור לאינטרנט - העבודה במצב אופליין';
    document.body.prepend(offlineMessage);
  }
}

// מאזין לשינויים בסטטוס החיבור
window.addEventListener('online', () => {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.remove();
});

window.addEventListener('offline', handleOfflineMode);

// אתחול בדיקת מצב אופליין
document.addEventListener('DOMContentLoaded', handleOfflineMode);