import * as api from './js/api.js';
import * as simulation from './js/simulation.js';
import * as ui from './js/ui.js';
import * as utils from './js/utils.js';
import { state, addStockToPortfolio, removeStockFromPortfolio } from './js/state.js';

// --- Event Listeners ---

// Section 1: Portfolio Management
ui.dom.dataSourceTypeSelect.addEventListener('change', () => ui.toggleDataSourceView());

ui.dom.symbolSearchInput.addEventListener('input', () => {
    clearTimeout(state.searchTimeout);
    const query = ui.dom.symbolSearchInput.value.trim();
    if (query.length > 1) {
        ui.updateStatus(`Searching for "${query}"...`);
        state.searchTimeout = setTimeout(async () => {
            try {
                const contracts = await api.searchSymbols(query);
                ui.populateSearchResults(contracts);
            } catch (error) {
                ui.showError(error.message, 'statusLabel');
            }
        }, 500); // 500ms debounce
    } else {
        ui.dom.symbolSearchResults.classList.add('hidden');
        ui.updateStatus('');
    }
});

ui.dom.addStockFromIbkrBtn.addEventListener('click', async () => {
    const selectedOption = ui.dom.symbolSearchResults.options[ui.dom.symbolSearchResults.selectedIndex];
    if (!selectedOption) {
        return alert("Please select a product from the search results.");
    }
    const { value: conId, dataset: { symbol } } = selectedOption;

    if (state.portfolio[symbol.toUpperCase()]) {
        return alert(`Product ${symbol.toUpperCase()} already exists in the portfolio.`);
    }

    ui.toggleButtonLoading(ui.dom.addStockFromIbkrBtn, true, 'addStockSpinner');
    ui.updateStatus(`Loading historical data for ${symbol}...`);

    try {
        const data = await api.fetchHistoricalDataByConId(conId);
        addStockToPortfolio(symbol, data);
        ui.renderPortfolioList();
        ui.clearSearchInputs();
        ui.updateStatus(`Product ${symbol} with ${data.length} records loaded successfully.`);
    } catch (error) {
        ui.showError(`Error loading ${symbol}: ${error.message}`, 'statusLabel');
    } finally {
        ui.toggleButtonLoading(ui.dom.addStockFromIbkrBtn, false, 'addStockSpinner');
    }
});

ui.dom.fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    const symbol = ui.dom.symbolInputCsv.value.trim();
    if (!file || !symbol) return alert("Please enter a symbol and select a CSV file.");
    if (state.portfolio[symbol.toUpperCase()]) return alert(`Stock ${symbol.toUpperCase()} already exists in the portfolio.`);

    ui.updateStatus(`Loading file for ${symbol}...`);
    try {
        const data = await utils.parseCsvFile(file, utils.csvConfigs.stock);
        addStockToPortfolio(symbol, data);
        ui.renderPortfolioList();
        ui.dom.symbolInputCsv.value = '';
        ui.dom.fileInput.value = '';
        ui.updateStatus(`File for ${symbol} loaded successfully.`);
    } catch (error) {
        ui.showError(`Error in stock file: ${error.message}`, 'statusLabel');
    }
});

// הוסף את הקוד הזה יחד עם שאר מאזיני האירועים של "Portfolio Management"

const loadHoldingsBtn = document.getElementById('loadHoldingsBtn');
const loadHoldingsSpinner = document.getElementById('loadHoldingsSpinner');

loadHoldingsBtn.addEventListener('click', async () => {
    ui.toggleButtonLoading(loadHoldingsBtn, true, 'loadHoldingsSpinner');
    ui.updateStatus("טוען רשימת נכסים מחשבון IBKR...");

    try {
        const holdings = await api.fetchHoldingsList();

        if (holdings.length === 0) {
            ui.updateStatus("לא נמצאו נכסים בחשבון IBKR הפעיל.");
            ui.toggleButtonLoading(loadHoldingsBtn, false, 'loadHoldingsSpinner');
            return;
        }

        ui.updateStatus(`נמצאו ${holdings.length} נכסים. מתחיל בטעינת נתונים היסטוריים...`);
        let loadedCount = 0;
        let errorCount = 0;

        // עבור בלולאה על כל נכס וטען את הנתונים שלו
        for (const holding of holdings) {
            const symbol = holding.symbol.toUpperCase();
            const conId = holding.conId;

            // בדוק אם הנכס כבר קיים בפורטפוליו כדי למנוע הוספה כפולה
            if (state.portfolio[symbol]) {
                console.log(`Skipping ${symbol}, as it is already in the portfolio.`);
                continue;
            }

            try {
                ui.updateStatus(`(${loadedCount + errorCount + 1}/${holdings.length}) טוען נתונים עבור ${symbol}...`);
                const data = await api.fetchHistoricalDataByConId(conId);
                addStockToPortfolio(symbol, data); // Uses the existing function from state.js
                loadedCount++;
            } catch (error) {
                console.error(`Failed to load historical data for ${symbol}:`, error);
                errorCount++;
            }
        }
        
        // רענן את תצוגת התיק פעם אחת בלבד בסוף כל התהליך ליעילות
        ui.renderPortfolioList(); 
        
        let finalMessage = `${loadedCount} נכסים נטענו בהצלחה.`;
        if (errorCount > 0) {
            finalMessage += ` נכשל בטעינת נתונים עבור ${errorCount} נכסים (בדוק את הלוג לקבלת פרטים).`;
        }
        ui.updateStatus(finalMessage);

    } catch (error) {
        ui.showError(error.message, 'statusLabel');
    } finally {
        ui.toggleButtonLoading(loadHoldingsBtn, false, 'loadHoldingsSpinner');
    }
});

ui.dom.interestRateFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    ui.updateStatus(`Loading interest rate file...`);
    try {
        state.interestRateData = await utils.parseCsvFile(file, utils.csvConfigs.interest);
        ui.updateStatus(`Interest rate file loaded. ${state.interestRateData.length} records.`);
    } catch (error) {
        ui.showError(`Error in interest rate file: ${error.message}`, 'statusLabel');
    }
});

ui.dom.portfolioListContainer.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    const symbol = button.dataset.symbol;
    if (button.classList.contains('define-strategy-btn')) {
        state.currentlyEditingSymbol = symbol;
        ui.showStrategyModal(symbol);
    } else if (button.classList.contains('remove-stock-btn')) {
        if (confirm(`האם אתה בטוח שברצונך להסיר את ${symbol} מהתיק?`)) {
            removeStockFromPortfolio(symbol);
            ui.renderPortfolioList();
        }
    }
});

ui.dom.portfolioListContainer.addEventListener('input', (event) => {
    const input = event.target;
    if (input.classList.contains('allocation-input')) {
        const symbol = input.dataset.symbol;
        const value = parseFloat(input.value);
        if (state.portfolio[symbol] && !isNaN(value)) {
            state.portfolio[symbol].allocation_pct = value;
            ui.updateTotalAllocation();
        }
    }
});

// Section 2: Main Simulation
ui.dom.runSimulationBtn.addEventListener('click', async () => {
    ui.toggleButtonLoading(ui.dom.runSimulationBtn, true, 'simulationSpinner');
    ui.updateStatus("Starting portfolio simulation...");
    ui.clearResults();

    try {
        const params = ui.getSimulationParameters();
        const results = params.userDefinedRanges.map(range => {
            const singleRunParams = {...params, range };
            // Pass a copy of the portfolio and historical data to avoid mutation across runs
            return simulation.simulatePortfolioStrategy({
                ...singleRunParams,
                portfolioConfig: JSON.parse(JSON.stringify(params.portfolioConfig)),
                allHistoricalData: JSON.parse(JSON.stringify(params.allHistoricalData))
            });
        });
        ui.renderSimulationResults(results);
        ui.updateStatus("Portfolio simulation finished successfully.");
        ui.renderActionPlanUI(); // Make stage 3 visible
    } catch (error) {
        ui.showError(error.message, 'statusLabel');
    } finally {
        ui.toggleButtonLoading(ui.dom.runSimulationBtn, false, 'simulationSpinner');
    }
});

// Section 3: Action Plan
ui.dom.generateActionPlanBtn.addEventListener('click', async () => {
    ui.toggleButtonLoading(ui.dom.generateActionPlanBtn, true, 'actionPlanSpinner');
    ui.dom.actionPlanResults.innerHTML = `<div class="text-center p-4">Calculating action plan...<div class="spinner inline-block ml-2"></div></div>`;

    try {
        const { userHoldings, currentDebt } = ui.getActionPlanInputs();
        
        ui.updateStatus("Fetching latest prices from IBKR server...");
        const currentPrices = await api.fetchCurrentPrices(Object.keys(state.portfolio));
        ui.updateStatus("Latest prices loaded successfully.");

        const plan = simulation.generateActionPlan({
            userHoldings,
            currentDebt,
            currentPrices,
            portfolio: state.portfolio,
            historicalData: state.historicalData
        });

        ui.displayActionPlan(plan);

    } catch (error) {
        ui.showError(error.message, 'actionPlanResults');
        ui.updateStatus(`Error: ${error.message}`);
    } finally {
        ui.toggleButtonLoading(ui.dom.generateActionPlanBtn, false, 'actionPlanSpinner');
    }
});


// --- Strategy Modal Event Listeners ---
ui.dom.closeStrategyModalBtn.addEventListener('click', () => ui.hideStrategyModal());
ui.dom.addOptimizationDateRangeBtn.addEventListener('click', () => utils.addDateRangeRow(ui.dom.optimizationDateRangesContainer));
ui.dom.addSimulationDateRangeBtn.addEventListener('click', () => utils.addDateRangeRow(ui.dom.simulationDateRangesContainer));
ui.dom.trailingStopPercentInput.addEventListener('input', ui.updateStrategyFeedback);

ui.dom.runOptimizationBtn.addEventListener('click', async () => {
    ui.toggleButtonLoading(ui.dom.runOptimizationBtn, true, 'optimizationSpinner');
    ui.updateStatus(`Starting robustness test for ${state.currentlyEditingSymbol}...`);
    ui.hideElement(ui.dom.optimizationResultsSection);

    try {
        const params = ui.getOptimizationParameters();

        // --- FIX: Pass the correct symbol to the simulation ---
        params.symbol = state.currentlyEditingSymbol;
        
        const results = await simulation.runFullOptimization(params, (progress) => {
            ui.updateStatus(progress);
        });
        state.lastAveragedResults = results;
        ui.displayOptimizationResults(results);
        ui.updateStatus(`Robustness test for ${state.currentlyEditingSymbol} finished.`);
    } catch (error) {
        ui.showError(error.message, 'statusLabel');
    } finally {
        ui.toggleButtonLoading(ui.dom.runOptimizationBtn, false, 'optimizationSpinner');
    }
});

ui.dom.manualShowBtn.addEventListener('click', () => {
    const recommendations = ui.updateSelectedDipsFromFilters(false);
    state.lastOptimizationRecommendations = simulation.calculateRelativeWeights(recommendations);
});

ui.dom.calculateAndShowBtn.addEventListener('click', () => {
    const recommendations = ui.updateSelectedDipsFromFilters(true);
    state.lastOptimizationRecommendations = simulation.calculateRelativeWeights(recommendations);
});

ui.dom.generatePlanFromSelectionBtn.addEventListener('click', () => {
    const selectedResults = ui.getSelectedDipResults();
    if (selectedResults.length === 0) {
        return alert("No dips selected. Please select dips from the chart or use auto-selection.");
    }
    const recommendations = simulation.calculateRelativeWeights(selectedResults);
    state.lastOptimizationRecommendations = recommendations;
    ui.displayRecommendations(recommendations, "Plan Based on Current Selection");
});

ui.dom.calculateLeveragePlanBtn.addEventListener('click', () => {
    if (state.lastOptimizationRecommendations.length === 0) {
        return alert("Please generate a list of recommendations first.");
    }
    try {
        const params = ui.getLeveragePlanInputs();
        const results = simulation.calculateOptimalLeveragePlan(params);
        ui.displayLeveragePlan({ ...results, ...params });
    } catch (error) {
        alert(`Error calculating plan: ${error.message}`);
    }
});

// --- WebSocket Connection ---
function connectWebSocket() {
    // ודא שהכתובת תואמת לשרת שלך
    const ws = new WebSocket('ws://localhost:3000');

    ws.onopen = () => {
        console.log('[WS_CLIENT] Connected to the WebSocket server.');
        ui.updateStatus("מחובר לעדכוני פקודות חיים."); // עדכון סטטוס למשתמש
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            // console.log('[WS_CLIENT] Message received:', message.type); // אפשר להשאיר להדפסה או להסיר

            if (message.type === 'order_update') {
                // קריאה לפונקציית ה-UI לעדכון פקודה בודדת
                ui.updateLiveOrder(message.payload);
            } else if (message.type === 'all_orders') {
                // קריאה לפונקציית ה-UI לאכלוס הטבלה עם כל הפקודות
                ui.setAllLiveOrders(message.payload);
            }

        } catch (error) {
            console.error('[WS_CLIENT] Error parsing message:', error);
        }
    };

    ws.onclose = () => {
        console.log('[WS_CLIENT] Disconnected from the WebSocket server. Attempting to reconnect in 5 seconds...');
        ui.updateStatus("החיבור לעדכונים חיים נותק. מנסה להתחבר מחדש...");
        // הוספת לוגיקה לניסיון התחברות מחדש
        setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => {
        console.error('[WS_CLIENT] WebSocket error:', error);
        ui.showError("החיבור לעדכונים חיים נכשל.", "statusLabel");
    };
}


// --- Auto-Trader Control Listeners ---
const startAutoTraderBtn = document.getElementById('startAutoTraderBtn');
const stopAutoTraderBtn = document.getElementById('stopAutoTraderBtn');
const autoTraderStatus = document.getElementById('autoTraderStatus');

if (startAutoTraderBtn) { // Add checks to ensure elements exist
    startAutoTraderBtn.addEventListener('click', async () => {
        try {
            const response = await api.startAutoTrader();
            ui.updateStatus(response.message); // Show success message from server

            autoTraderStatus.textContent = 'סטטוס: פעיל';
            autoTraderStatus.classList.add('text-green-600');
            autoTraderStatus.classList.remove('text-slate-600');
            startAutoTraderBtn.disabled = true;
            stopAutoTraderBtn.disabled = false;
        } catch (error) {
            ui.showError(error.message, 'statusLabel');
        }
    });
}

if (stopAutoTraderBtn) {
    stopAutoTraderBtn.addEventListener('click', async () => {
        try {
            const response = await api.stopAutoTrader();
            ui.updateStatus(response.message); // Show success message from server

            autoTraderStatus.textContent = 'סטטוס: כבוי';
            autoTraderStatus.classList.remove('text-green-600');
            autoTraderStatus.classList.add('text-slate-600');
            startAutoTraderBtn.disabled = false;
            stopAutoTraderBtn.disabled = true;
        } catch (error) {
            ui.showError(error.message, 'statusLabel');
        }
    });
}


// --- Initialization ---
function initializeApp() {
    ui.loadState();
    ui.renderPortfolioList();
    utils.setupInitialDateRanges(ui.dom.optimizationDateRangesContainer, ui.dom.simulationDateRangesContainer);
    ui.toggleDataSourceView();
    connectWebSocket(); // <-- Added this line
}

document.addEventListener('DOMContentLoaded', initializeApp);
window.addEventListener('beforeunload', () => ui.saveState());