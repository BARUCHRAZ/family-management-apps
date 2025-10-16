const IB_API_BASE_URL = 'http://localhost:3000/api';

/**
 * Searches for contracts (symbols) via the local IBKR server.
 * @param {string} query - The search query.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of contracts.
 */
export async function searchSymbols(query) {
    const response = await fetch(`${IB_API_BASE_URL}/search-symbol?query=${encodeURIComponent(query)}`);
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Server error (${response.status})`);
    }
    return await response.json();
}

/**
 * Fetches historical data for a given contract ID (conId).
 * Includes an automatic data sanitization layer to fix common data spikes.
 * @param {string} conId - The IBKR contract ID.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of historical data points.
 */
export async function fetchHistoricalDataByConId(conId) {
    const url = `${IB_API_BASE_URL}/get-historical-data?conId=${conId}&duration=20%20Y`;
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error (${response.status})`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No historical data received from the server.");
    }

    // --- שכבת ניקוי הנתונים מתחילה כאן ---
    const SPIKE_THRESHOLD_FACTOR = 1.5; // מאפשר קפיצה של עד 50% ביום. ניתן להתאים.
    const cleanData = data.map(row => ({ // יוצרים עותק כדי לא לשנות את המקור ישירות
        ...row,
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close)
    })).sort((a,b) => new Date(a.date.substring(0, 4), a.date.substring(4, 6) - 1, a.date.substring(6, 8)) - new Date(b.date.substring(0, 4), b.date.substring(4, 6) - 1, b.date.substring(6, 8)));

    for (let i = 1; i < cleanData.length; i++) {
        const today = cleanData[i];
        const yesterday = cleanData[i - 1];

        // בדיקה 1: האם ה-high של היום גבוה באופן לא סביר מה-close של אתמול?
        if (today.high > yesterday.close * SPIKE_THRESHOLD_FACTOR) {
            console.warn(`[DATA SANITIZATION] Potential spike detected on ${today.date}. High: ${today.high}, Previous Close: ${yesterday.close}. Correcting high to ${today.close}.`);
            today.high = today.close; // תיקון: הגדר את ה-high להיות כמו ה-close של אותו יום
        }

        // בדיקה 2: האם ה-low נמוך באופן לא סביר?
        if (today.low < yesterday.close / SPIKE_THRESHOLD_FACTOR) {
             console.warn(`[DATA SANITIZATION] Potential drop detected on ${today.date}. Low: ${today.low}, Previous Close: ${yesterday.close}. Correcting low to ${today.close}.`);
             today.low = today.close;
        }
    }
    // --- שכבת ניקוי הנתונים מסתיימת כאן ---

    return cleanData.map(row => { // ממשיכים עם cleanData במקום data המקורי
        const year = parseInt(row.date.substring(0, 4), 10);
        const month = parseInt(row.date.substring(4, 6), 10) - 1; // Month is 0-indexed
        const day = parseInt(row.date.substring(6, 8), 10);
        return {
            date: new Date(Date.UTC(year, month, day)), // Use UTC
            open: row.open,
            high: row.high,
            low: row.low,
            price: row.close // Map 'close' to 'price'
        };
    }).filter(r => !isNaN(r.date.getTime())).sort((a, b) => a.date - b.date);
}

/**
 * Fetches the current price for a single symbol.
 * @param {string} symbol - The symbol to fetch the price for.
 * @returns {Promise<{symbol: string, price: number}>} A promise that resolves to an object with the symbol and its price.
 */
async function fetchCurrentPriceFromIBKR(symbol) {
    const url = `${IB_API_BASE_URL}/get-price?symbol=${symbol}`;
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error (${response.status}) for ${symbol}`);
    }
    const data = await response.json();
    if (!data || typeof data.price !== 'number') {
        throw new Error(`No valid current price found for ${symbol} from the server.`);
    }
    return { symbol, price: data.price };
}

/**
 * Fetches current prices for multiple symbols concurrently.
 * @param {Array<string>} symbols - An array of symbols.
 * @returns {Promise<object>} A promise that resolves to an object mapping symbols to their prices.
 */
export async function fetchCurrentPrices(symbols) {
    const pricePromises = symbols.map(symbol => fetchCurrentPriceFromIBKR(symbol));
    const results = await Promise.all(pricePromises);
    const prices = {};
    for (const result of results) {
        prices[result.symbol] = result.price;
    }
    return prices;
}

/**
 * Places a trading order via the server.
 * This function sends a POST request to the '/api/place-order' endpoint.
 * @param {object} orderDetails - The details of the order to place. 
 * Example: { symbol: 'AAPL', secType: 'STK', action: 'BUY', quantity: 10, orderType: 'MKT' }
 * @returns {Promise<object>} A promise that resolves to the server's JSON response (e.g., { message, orderId }).
 */
export async function placeOrder(orderDetails) {
    const url = `${IB_API_BASE_URL}/place-order`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderDetails),
        });

        const responseData = await response.json();

        if (!response.ok) {
            // If the server responded with an error status (4xx, 5xx), throw an error
            // using the message from the server's JSON response.
            throw new Error(responseData.error || `Server error (${response.status}) when placing order.`);
        }

        return responseData;

    } catch (error) {
        // This will catch network errors or errors from the 'throw' statement above.
        console.error('Error in placeOrder API call:', error);
        // Re-throw the error so the calling function (in the UI) can handle it.
        throw error;
    }
}

/**
 * Sends a request to cancel a specific order.
 * @param {number} orderId - The ID of the order to cancel.
 * @returns {Promise<object>} A promise that resolves to the server's response.
 */
export async function cancelOrder(orderId) {
    const url = `${IB_API_BASE_URL}/cancel-order`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderId }),
        });
        const responseData = await response.json();
        if (!response.ok) {
            throw new Error(responseData.error || `Server error (${response.status})`);
        }
        return responseData;
    } catch (error) {
        console.error('Error in cancelOrder API call:', error);
        throw error;
    }
}

/**
 * Fetches the list of current holdings (symbol and conId) from the server.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of holdings.
 */
export async function fetchHoldingsList() {
    const response = await fetch(`${IB_API_BASE_URL}/get-holdings-list`);
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch holdings list.');
    }
    return response.json();
}

/**
 * Sends a request to the server to start the auto-trading agent.
 * @returns {Promise<object>}
 */
export async function startAutoTrader() {
    const response = await fetch(`${IB_API_BASE_URL}/start-auto-trader`, { method: 'POST' });
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to start auto-trader');
    }
    return response.json();
}

/**
 * Sends a request to the server to stop the auto-trading agent.
 * @returns {Promise<object>}
 */
export async function stopAutoTrader() {
    const response = await fetch(`${IB_API_BASE_URL}/stop-auto-trader`, { method: 'POST' });
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to stop auto-trader');
    }
    return response.json();
}