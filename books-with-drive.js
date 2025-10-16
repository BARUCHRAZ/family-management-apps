/**
 * עדכון מערכת הספרים לעבוד עם Google Drive
 * במקום Firebase
 */

// אתחול מסד הנתונים החדש
const db = new GoogleDriveDB();

// משתנים גלובליים
let books = [];
let isLoading = false;

// פונקציות לניהול ספרים עם Google Drive
const BooksManager = {
    
    // טעינת כל הספרים
    async loadBooks() {
        if (isLoading) return;
        isLoading = true;
        
        try {
            console.log('📚 טוען ספרים...');
            showLoadingIndicator(true);
            
            const data = await db.loadData('books.json');
            books = data || [];
            
            console.log(`✅ נטענו ${books.length} ספרים`);
            renderBooks();
            updateStats();
            
        } catch (error) {
            console.error('❌ שגיאה בטעינת ספרים:', error);
            showNotification('שגיאה בטעינת הספרים', 'error');
        } finally {
            isLoading = false;
            showLoadingIndicator(false);
        }
    },
    
    // שמירת כל הספרים
    async saveBooks() {
        try {
            console.log('💾 שומר ספרים...');
            showLoadingIndicator(true);
            
            const success = await db.saveData('books.json', books);
            
            if (success) {
                console.log('✅ הספרים נשמרו');
                showNotification('השינויים נשמרו', 'success');
            } else {
                throw new Error('שמירה נכשלה');
            }
            
        } catch (error) {
            console.error('❌ שגיאה בשמירת ספרים:', error);
            showNotification('שגיאה בשמירת הספרים', 'error');
        } finally {
            showLoadingIndicator(false);
        }
    },
    
    // הוספת ספר חדש
    async addBook(bookData) {
        try {
            const newBook = {
                id: generateId(),
                ...bookData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            books.push(newBook);
            await this.saveBooks();
            
            renderBooks();
            updateStats();
            
            return newBook;
            
        } catch (error) {
            console.error('❌ שגיאה בהוספת ספר:', error);
            showNotification('שגיאה בהוספת הספר', 'error');
            throw error;
        }
    },
    
    // עדכון ספר קיים
    async updateBook(id, updateData) {
        try {
            const index = books.findIndex(book => book.id === id);
            if (index === -1) {
                throw new Error('ספר לא נמצא');
            }
            
            books[index] = {
                ...books[index],
                ...updateData,
                updatedAt: new Date().toISOString()
            };
            
            await this.saveBooks();
            
            renderBooks();
            updateStats();
            
            return books[index];
            
        } catch (error) {
            console.error('❌ שגיאה בעדכון ספר:', error);
            showNotification('שגיאה בעדכון הספר', 'error');
            throw error;
        }
    },
    
    // מחיקת ספר
    async deleteBook(id) {
        try {
            if (!confirm('האם אתה בטוח שברצונך למחוק את הספר?')) {
                return;
            }
            
            books = books.filter(book => book.id !== id);
            await this.saveBooks();
            
            renderBooks();
            updateStats();
            
            showNotification('הספר נמחק בהצלחה', 'success');
            
        } catch (error) {
            console.error('❌ שגיאה במחיקת ספר:', error);
            showNotification('שגיאה במחיקת הספר', 'error');
        }
    },
    
    // חיפוש ספרים
    searchBooks(searchTerm) {
        const filtered = books.filter(book =>
            book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (book.isbn && book.isbn.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        
        renderBooks(filtered);
        return filtered;
    },
    
    // יצירת גיבוי
    async createBackup() {
        try {
            await db.createBackup();
            showNotification('גיבוי נוצר בהצלחה', 'success');
        } catch (error) {
            console.error('❌ שגיאה ביצירת גיבוי:', error);
            showNotification('שגיאה ביצירת גיבוי', 'error');
        }
    },
    
    // ייבוא נתונים
    async importData(data) {
        try {
            if (!Array.isArray(data)) {
                throw new Error('נתונים לא תקינים');
            }
            
            // מיזוג עם הנתונים הקיימים
            for (const newBook of data) {
                if (newBook.title && newBook.author) {
                    newBook.id = generateId();
                    newBook.createdAt = new Date().toISOString();
                    newBook.updatedAt = new Date().toISOString();
                    books.push(newBook);
                }
            }
            
            await this.saveBooks();
            renderBooks();
            updateStats();
            
            showNotification(`יובאו ${data.length} ספרים בהצלחה`, 'success');
            
        } catch (error) {
            console.error('❌ שגיאה בייבוא נתונים:', error);
            showNotification('שגיאה בייבוא הנתונים', 'error');
        }
    },
    
    // ייצוא נתונים
    exportData() {
        try {
            const dataStr = JSON.stringify(books, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `books_export_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            showNotification('הנתונים יוצאו בהצלחה', 'success');
            
        } catch (error) {
            console.error('❌ שגיאה בייצוא נתונים:', error);
            showNotification('שגיאה בייצוא הנתונים', 'error');
        }
    },
    
    // בדיקת סטטוס החיבור
    getConnectionStatus() {
        return db.getStatus();
    }
};

// פונקציות עזר
const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const showLoadingIndicator = (show) => {
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
        indicator.style.display = show ? 'block' : 'none';
    }
};

const showNotification = (message, type = 'info') => {
    // הודעות משוב למשתמש
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
};

// פונקציות הממשק (renderBooks, updateStats וכו')
// ...הקוד הקיים שלך נשאר כמו שהוא

// אתחול האפליקציה
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 מתחיל את מערכת הספרים...');
    
    // טעינת הספרים
    await BooksManager.loadBooks();
    
    // הגדרת מאזיני אירועים
    setupEventListeners();
    
    // הצגת סטטוס החיבור
    const status = BooksManager.getConnectionStatus();
    console.log('🔗 סטטוס חיבור:', status);
    
    showNotification(`מחובר ל${status.storage}`, 'info');
});

console.log('📚 מערכת ספרים עם Google Drive מוכנה!');

// יצוא לשימוש גלובלי
window.BooksManager = BooksManager;