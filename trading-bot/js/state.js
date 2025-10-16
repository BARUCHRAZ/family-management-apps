export const LOCAL_STORAGE_KEY = 'tradingSimulatorState_portfolio_ibkr';
export const INITIAL_CAPITAL = 100000;

// The state object is now exported directly.
export const state = {
    historicalData: {},
    portfolio: {},
    interestRateData: [],
    currentlyEditingSymbol: null,
    lastAveragedResults: [],
    lastOptimizationRecommendations: [],
    searchTimeout: null,
};

// --- GETTERS (Functions to read state) ---

/**
 * Returns a copy of the portfolio.
 * @returns {object} The portfolio object.
 */
export function getPortfolio() {
    return state.portfolio;
}

/**
 * Returns the entire historical data object.
 * @returns {object} The historical data object.
 */
export function getHistoricalData() {
    return state.historicalData;
}


// --- SETTERS / MUTATIONS (Functions to modify state) ---

/**
 * Adds a new stock to the portfolio state.
 * @param {string} symbol - The stock symbol.
 * @param {Array<object>} data - The historical data for the stock.
 */
export function addStockToPortfolio(symbol, data) {
    symbol = symbol.toUpperCase();
    if (state.portfolio[symbol]) {
        console.warn(`Stock ${symbol} already in portfolio.`);
        return;
    }

    console.log(`[STATE_DEBUG] Adding data for symbol: '${symbol}'`);
    console.log(`[STATE_DEBUG] Number of data points: ${data.length}`);
    console.log(`[STATE_DEBUG] First data point being saved:`, data[0]);
    console.log(`[STATE_DEBUG] Last data point being saved:`, data[data.length - 1]);

    state.historicalData[symbol] = data;
    state.portfolio[symbol] = {
        allocation_pct: 0,
        strategy: null
    };
}

/**
 * Removes a stock from the portfolio state.
 * @param {string} symbol - The stock symbol to remove.
 */
export function removeStockFromPortfolio(symbol) {
    symbol = symbol.toUpperCase();
    if (state.portfolio[symbol]) {
        delete state.portfolio[symbol];
        delete state.historicalData[symbol];
    }
}

/**
 * Saves a calculated strategy to the specified symbol in the portfolio.
 * @param {string} symbol - The symbol to save the strategy for.
 * @param {object} strategy - The strategy object.
 */
export function setStrategyForSymbol(symbol, strategy) {
    // FIXED: Added toUpperCase() for consistency and to prevent bugs.
    symbol = symbol.toUpperCase();
    if (state.portfolio[symbol]) {
        state.portfolio[symbol].strategy = strategy;
    }
}