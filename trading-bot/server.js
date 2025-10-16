const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const path = require('path');
const { IBApi, EventName, SecType } = require("@stoqey/ib");

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Middleware setup
app.use(cors());
app.use(express.json()); // Added to parse JSON bodies in POST requests
app.use(express.static(path.join(__dirname, '')));

// --- WebSocket Server Setup (מופעל פעם אחת עם עליית השרת) ---
const wss = new WebSocketServer({ server });

function broadcast(data) {
    wss.clients.forEach(client => {
        // Use client.OPEN which is equivalent to WebSocket.OPEN (value of 1)
        if (client.readyState === client.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

wss.on('connection', ws => {
    console.log('[WSS] Client connected');
    try {
        // שלח את רשימת הפקודות הנוכחית ללקוח החדש שהתחבר
        ws.send(JSON.stringify({
            type: 'all_orders',
            payload: Array.from(activeOrders.values())
        }));
    } catch (error) {
        console.error('[WSS] Error sending initial orders:', error);
    }
    
    ws.on('close', () => console.log('[WSS] Client disconnected'));
    ws.on('error', (error) => console.error('[WSS] WebSocket client error:', error));
});

console.log('[WSS] WebSocket server is ready and listening for connections.');


// Interactive Brokers API connection setup
const ib = new IBApi({ host: '127.0.0.1', port: 4002 });
let isIbConnected = false;
let nextOrderId = null; // Global variable for the next order ID
const activeOrders = new Map(); // Data store for active orders
const accountState = { positions: new Map() }; // Data store for account positions/holdings

// --- Auto-Trader State Variables ---
let autoTraderInterval = null; // ישמור את המזהה של לולאת ה-setInterval
let isAutoTraderRunning = false; // יתעד את מצב הריצה של הסוכן
const AUTO_TRADER_FREQUENCY_MS = 60000; // תדירות הבדיקה (בדוגמה: פעם ב-60 שניות)


ib.on(EventName.connected, () => {
    console.log("Successfully connected to IB Gateway.");
    isIbConnected = true;
}); // סוף ה-ib.on(EventName.connected, ...) - בלוק זה נקי מלוגיקת WSS


// --- Order Status & Portfolio Event Listeners (מוגדרים מחוץ ל-connected כדי לגשת ל-broadcast) ---

ib.on(EventName.openOrder, (orderId, contract, order, orderState) => {
    console.log(`[EVENT:openOrder] ID: ${orderId.id}, Action: ${order.action}, Ticker: ${contract.symbol}, Status: ${orderState.status}`);
    
    // שמור את פרטי הפקודה המלאים בפעם הראשונה שפוגשים אותה
    const orderData = {
        id: orderId.id,
        symbol: contract.symbol,
        action: order.action,
        quantity: order.totalQuantity,
        orderType: order.orderType,
        limitPrice: order.lmtPrice,
        status: orderState.status,
        filled: 0,
        remaining: order.totalQuantity,
        avgFillPrice: 0,
    };
    activeOrders.set(orderId.id, orderData);

    // שידור העדכון ללקוחות
    broadcast({ type: 'order_update', payload: orderData });
});

ib.on(EventName.orderStatus, (orderId, status, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld, mktCapPrice) => {
    console.log(`[EVENT:orderStatus] ID: ${orderId}, Status: ${status}, Filled: ${filled}, Remaining: ${remaining}, AvgFillPrice: ${avgFillPrice}`);
    
    // עדכן את פרטי הסטטוס של הפקודה הקיימת
    const existingOrder = activeOrders.get(orderId);
    if (existingOrder) {
        existingOrder.status = status;
        existingOrder.filled = filled;
        existingOrder.remaining = remaining;
        existingOrder.avgFillPrice = avgFillPrice;

        // שידור העדכון ללקוחות
        broadcast({ type: 'order_update', payload: existingOrder });
    }
});

// מאזין חדש לעדכון הפורטפוליו (הפוזיציות)
ib.on(EventName.updatePortfolio, (contract, position, marketPrice, marketValue, averageCost, unrealizedPNL, realizedPNL, accountName) => {
    // נתמקד במניות (STK) ו-CASH (מט"ח) כדי למנוע כפילויות עם נכסים אחרים
    if (contract.secType !== 'STK' && contract.secType !== 'CASH') return;
    
    const symbol = contract.secType === 'CASH' ? `${contract.symbol}.${contract.currency}` : contract.symbol;
    
    if (position === 0) {
        accountState.positions.delete(symbol);
        console.log(`[Portfolio] Position closed for ${symbol}. Removed from holdings.`);
    } else {
        // השינוי המרכזי: שמירת ה-conId יחד עם כמות המניות
        accountState.positions.set(symbol, { 
            position: position, 
            conId: contract.conId 
        });
        console.log(`[Portfolio] Updated position for ${symbol}: ${position} shares/units (conId: ${contract.conId})`);
    }
});

// Listener for the nextValidId event
ib.on(EventName.nextValidId, (orderId) => {
    console.log(`Received next valid order ID: ${orderId}`);
    nextOrderId = orderId;
});

ib.on(EventName.disconnected, () => {
    console.log("Disconnected from IB Gateway.");
    isIbConnected = false;
    nextOrderId = null; // Reset on disconnect
});

// מאזין שגיאות משופר
ib.on(EventName.error, (err, code, reqId) => {
    // A list of warning codes to ignore safely
    const warnings = [2104, 2106, 2108, 2158]; // market data messages
    
    if (warnings.includes(code)) {
        return;
    }
    
    console.error(`[IB_ERROR] Code: ${code} | ReqId: ${reqId} | ${err.message}`);
});

// --- Auto-Trader Logic Placeholder ---
function runAutoTraderCheck() {
    // TODO: This is where the core auto-trading logic will go.
    // For now, we just log a message to show that it's working.
    if (isAutoTraderRunning) {
        console.log(`[Auto-Trader] Running check at ${new Date().toLocaleTimeString()}... (Currently a placeholder)`);
    }
}


// Middleware to check for an active IB Gateway connection
const checkIbConnection = (req, res, next) => {
    if (!isIbConnected) {
        return res.status(503).json({ error: 'Not connected to IB Gateway.' });
    }
    // For portfolio updates, we need to request them
    // This will trigger the updatePortfolio events
    ib.reqAccountUpdates(true, ""); 
    next();
};

// --- API ENDPOINT TO SEARCH FOR SYMBOLS ---
app.get('/api/search-symbol', checkIbConnection, async (req, res) => {
    const query = decodeURIComponent(req.query.query || '');
    if (!query) {
        return res.status(400).json({ error: 'A search query must be provided.' });
    }
    console.log(`--- Search request for: "${query}" ---`);

    try {
        const symbolContracts = await new Promise((resolve, reject) => {
            const reqId = Math.floor(Math.random() * 10000);
            const listener = (id, contracts) => {
                if (id === reqId) {
                    ib.off(EventName.symbolSamples, listener);
                    resolve(contracts);
                }
            };
            const errorListener = (err, code, id) => {
                if(id === reqId) {
                    ib.off(EventName.symbolSamples, listener); // Deregister listener on error
                    reject(err);
                }
            }
            ib.on(EventName.symbolSamples, listener);
            ib.on(EventName.error, errorListener);
            ib.reqMatchingSymbols(reqId, query);
        });

        console.log(`[OK] Found ${symbolContracts.length} results.`);
        
        // --- Final processing logic ---
        const cleanContracts = symbolContracts.map(desc => {
            const contract = desc.contract;
            let symbol = contract.symbol;
            let companyName = desc.companyName || contract.longName || contract.description || '';

            // Special logic for Forex (CASH)
            if (contract.secType === 'CASH' && query.includes('.')) {
                symbol = query.toUpperCase();
                companyName = companyName || symbol;
            }
            
            // Handle empty symbols (common in bonds)
            if (!symbol && contract.secType === 'BOND' && companyName) {
                symbol = `BOND: ${companyName.substring(0, 10)}`;
            }

            return {
                conId: contract.conId,
                symbol: symbol,
                secType: contract.secType,
                exchange: contract.primaryExch || contract.exchange || 'N/A',
                currency: contract.currency,
                companyName: companyName,
            };
        });

        res.json(cleanContracts);

    } catch (err) {
        console.error("Search failed:", err);
        res.status(500).json({ error: `Search failed: ${err.message}` });
    }
});

// --- API ENDPOINT FOR HISTORICAL DATA ---
app.get('/api/get-historical-data', checkIbConnection, (req,res) => {
    const { duration = '5 Y', conId } = req.query;
    if (!conId) { return res.status(400).json({ error: 'A conId must be provided.' }); }
    
    const contract = { conId: parseInt(conId, 10), exchange: 'SMART' };
    console.log(`--- Historical data request for conId: ${conId} ---`);
    const reqId = Math.floor(Math.random() * 10000) + 20000;

    const getHistory = new Promise((resolve, reject) => {
        const historicalDataPoints = [];
        let errorOccurred = null;

        const dataListener = (id, date, open, high, low, close, volume) => {
            if (id !== reqId) return;
            if (date.startsWith("finished-")) {
                ib.off(EventName.historicalData, dataListener);
                ib.off(EventName.error, errorListener);
                if (errorOccurred) { 
                    reject(errorOccurred);
                } else {
                    console.log(`[OK] Finished receiving data. Total records: ${historicalDataPoints.length}.`);
                    resolve(historicalDataPoints);
                }
            } else {
                historicalDataPoints.push({ date, open, high, low, close, volume });
            }
        };

        const errorListener = (err, code, id) => {
            if (id === reqId && !err.message.includes("Warning:")) {
                errorOccurred = err;
            }
        };

        ib.on(EventName.historicalData, dataListener);
        ib.on(EventName.error, errorListener);
        
        const now = new Date();
        const endDateTime = `${now.getUTCFullYear()}${(now.getUTCMonth() + 1).toString().padStart(2, '0')}${now.getUTCDate().toString().padStart(2, '0')} 23:59:59 UTC`;
        ib.reqHistoricalData(reqId, contract, endDateTime, duration, '1 day', 'TRADES', 1, 1, false);
    });

    getHistory
        .then(data => data.length > 0 ? res.json(data) : res.status(404).json({ error: `No data found for the request.` }))
        .catch(err => res.status(500).json({ error: `Failed to retrieve historical data: ${err.message}` }));
});

// --- API ENDPOINT FOR CURRENT PRICE ---
app.get('/api/get-price', checkIbConnection, (req,res) => {
    const symbol = req.query.symbol;
    if (!symbol) { return res.status(400).json({ error: 'A stock symbol must be provided.' }); }

    const [mainSymbol, currency] = symbol.includes('.') ? symbol.split('.') : [symbol, 'USD'];
    const secType = symbol.includes('.') ? SecType.CASH : SecType.STK;
    const contract = { symbol: mainSymbol.toUpperCase(), secType: secType, exchange: 'SMART', currency: (currency || 'USD').toUpperCase() };
    console.log(`--- Price request for contract:`, contract);

    const reqId = Math.floor(Math.random() * 10000) + 1;
    ib.reqMarketDataType(3); // Request delayed data

    const priceUpdateListener = (tickerId, field, value) => {
        // Field 68 is 'Last trade price' or 'Close' on delayed data
        if (tickerId === reqId && field === 68 && value > -1) {
            res.json({ symbol: symbol.toUpperCase(), price: value });
            ib.off(EventName.tickPrice, priceUpdateListener);
            ib.cancelMktData(reqId);
        }
    };

    ib.on(EventName.tickPrice, priceUpdateListener);
    ib.reqMktData(reqId, contract, "", false, false);
});

// --- API ENDPOINT TO VIEW RAW DATA AS HTML ---
app.get('/api/view-data', checkIbConnection, (req,res) => {
    const { duration = '20 Y', conId } = req.query;
    if (!conId) { return res.status(400).json({ error: 'A conId must be provided.' }); }
    
    console.log(`--- Raw data view request for conId: ${conId} ---`);
    const contract = { conId: parseInt(conId, 10), exchange: 'SMART' };
    const reqId = Math.floor(Math.random() * 10000) + 30000;

    const getHistory = new Promise((resolve, reject) => {
        const historicalDataPoints = [];
        let errorOccurred = null;
        
        const dataListener = (id, date, open, high, low, close, volume) => {
            if (id !== reqId) return;
            if (date.startsWith("finished-")) {
                ib.off(EventName.historicalData, dataListener);
                ib.off(EventName.error, errorListener);
                if (errorOccurred) { reject(errorOccurred); } 
                else { resolve(historicalDataPoints); }
            } else {
                historicalDataPoints.push({ date, open, high, low, close, volume });
            }
        };

        const errorListener = (err, code, id) => { 
            if (id === reqId && !err.message.includes("Warning:")) { 
                errorOccurred = err; 
            }
        };

        ib.on(EventName.historicalData, dataListener);
        ib.on(EventName.error, errorListener);

        const now = new Date();
        const endDateTime = `${now.getUTCFullYear()}${(now.getUTCMonth() + 1).toString().padStart(2, '0')}${now.getUTCDate().toString().padStart(2, '0')} 23:59:59 UTC`;
        ib.reqHistoricalData(reqId, contract, endDateTime, duration, '1 day', 'TRADES', 1, 1, false);
    });

    getHistory
        .then(data => {
            if (data.length === 0) {
                return res.status(404).send('<h1>No data found</h1>');
            }
            // Sort data by closing price, descending, to see outliers first
            data.sort((a, b) => b.close - a.close);
            
            let tableRows = data.map(d => `
                <tr>
                    <td>${d.date}</td>
                    <td>${d.open}</td>
                    <td style="background-color: #ffcccc;"><strong>${d.high}</strong></td>
                    <td>${d.low}</td>
                    <td>${d.close}</td>
                    <td>${d.volume}</td>
                </tr>
            `).join('');

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Data for conId ${conId}</title>
                    <style>
                        body { font-family: sans-serif; }
                        table { border-collapse: collapse; width: 100%; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                    </style>
                </head>
                <body>
                    <h1>Historical Data for conId ${conId}</h1>
                    <p>Sorted by Highest Price Descending</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Open</th>
                                <th>High</th>
                                <th>Low</th>
                                <th>Close</th>
                                <th>Volume</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </body>
                </html>
            `;
            res.send(html);
        })
        .catch(err => res.status(500).send(`<h1>Error: ${err.message}</h1>`));
});

// --- ENDPOINT FOR PLACING ORDERS ---
app.post('/api/place-order', checkIbConnection, async (req, res) => {
    const {
        symbol,          // e.g., 'AAPL' for stock, 'EUR.USD' for forex
        secType,         // e.g., 'STK', 'CASH'
        action,          // 'BUY' or 'SELL'
        quantity,        // e.g., 100
        orderType,       // 'MKT' (Market), 'LMT' (Limit)
        limitPrice = 0,  // The limit price for LMT orders
        currency = 'USD'
    } = req.body;

    // --- Input Validation ---
    if (!symbol || !secType || !action || !quantity || !orderType) {
        return res.status(400).json({ error: 'Missing required order parameters: symbol, secType, action, quantity, orderType.' });
    }
    if (orderType === 'LMT' && (!limitPrice || limitPrice <= 0)) {
        return res.status(400).json({ error: 'Limit price is required for LMT orders.' });
    }

    console.log(`--- Order request received: ${action} ${quantity} ${symbol} @ ${orderType} ---`);

    try {
        // --- 1. Build the Contract object ---
        const contract = {
            symbol: symbol.toUpperCase(),
            secType: secType.toUpperCase(),
            exchange: 'SMART',
            currency: currency.toUpperCase(),
        };

        // --- 2. Build the Order object ---
        const order = {
            action: action.toUpperCase(),
            orderType: orderType.toUpperCase(),
            totalQuantity: parseFloat(quantity),
            lmtPrice: orderType === 'LMT' ? parseFloat(limitPrice) : undefined, // Only add lmtPrice for LMT orders
            tif: 'GTC', // Time-in-force: Good-'til-Canceled
        };

        // --- 3. Place the order ---
        if (nextOrderId === null) {
            return res.status(503).json({ error: "Server has not received a valid order ID from IBKR yet. Please try again in a moment." });
        }

        const currentOrderId = nextOrderId;
        console.log(`Placing order with ID: ${currentOrderId}`);
        ib.placeOrder(currentOrderId, contract, order);

        // Increment the order ID for the next use
        nextOrderId++;
        
        res.status(200).json({
            message: 'Order placed successfully.',
            orderId: currentOrderId, // Return the ID that was actually used
            details: { contract, order }
        });

    } catch (err) {
        console.error(`[ERROR] Failed to place order for ${symbol}:`, err);
        res.status(500).json({ error: `Failed to place order: ${err.message}` });
    }
});

// --- API ENDPOINT TO GET ACTIVE ORDERS ---
app.get('/api/get-orders', (req, res) => {
    // המר את ה-Map למערך של אובייקטים ושלח אותו כתגובת JSON
    const ordersArray = Array.from(activeOrders.values());
    res.status(200).json(ordersArray);
});

// --- API ENDPOINT TO CANCEL AN ORDER ---
app.post('/api/cancel-order', checkIbConnection, (req, res) => {
    const { orderId } = req.body;

    if (typeof orderId === 'undefined') {
        return res.status(400).json({ error: 'orderId is required.' });
    }

    const idToCancel = parseInt(orderId, 10);
    if (isNaN(idToCancel)) {
        return res.status(400).json({ error: 'Invalid orderId format.' });
    }
    
    // Check if the order is actually in our active list before trying to cancel
    if (!activeOrders.has(idToCancel)) {
        // This is a clean way to prevent sending useless requests to IB for orders that are long gone.
        return res.status(404).json({ error: `Order with ID ${idToCancel} not found in active orders.` });
    }

    console.log(`--- Cancel request for Order ID: ${idToCancel} ---`);
    ib.cancelOrder(idToCancel);

    res.status(200).json({ message: `Cancel request sent for order ${idToCancel}.` });
});

// --- API ENDPOINT TO GET HOLDINGS LIST FOR STRATEGY SETUP ---
app.get('/api/get-holdings-list', checkIbConnection, (req, res) => {
    // המרת המידע מה-Map למערך של אובייקטים פשוטים (symbol, conId)
    const holdings = Array.from(accountState.positions.entries()).map(([symbol, data]) => ({
        symbol: symbol,
        conId: data.conId
    }));
    console.log(`[API] Returning ${holdings.length} holdings to the client.`);
    res.status(200).json(holdings);
});

// --- ENDPOINTS TO CONTROL THE AUTO-TRADER ---

app.post('/api/start-auto-trader', checkIbConnection, (req, res) => {
    if (isAutoTraderRunning) {
        return res.status(400).json({ message: 'הסוכן האוטומטי כבר פועל.' });
    }
    console.log('[SERVER] Starting auto-trader...');
    isAutoTraderRunning = true;
    // הרץ את הבדיקה הראשונה מיד, ואז התחל את הלולאה
    runAutoTraderCheck();
    autoTraderInterval = setInterval(runAutoTraderCheck, AUTO_TRADER_FREQUENCY_MS);
    res.status(200).json({ message: 'הסוכן האוטומטי הופעל בהצלחה.' });
});

app.post('/api/stop-auto-trader', (req, res) => {
    if (!isAutoTraderRunning) {
        return res.status(400).json({ message: 'הסוכן האוטומטי אינו פועל.' });
    }
    console.log('[SERVER] Stopping auto-trader...');
    isAutoTraderRunning = false;
    clearInterval(autoTraderInterval);
    autoTraderInterval = null;
    res.status(200).json({ message: 'הסוכן האוטומטי כובה.' });
});


// שינוי זה קריטי! הפעל את השרת הראשי בלי קשר ל-IBKR
server.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
    console.log('Attempting to connect to IB Gateway...');
    ib.connect();
});