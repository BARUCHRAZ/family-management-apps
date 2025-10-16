import { state, setStrategyForSymbol, LOCAL_STORAGE_KEY, INITIAL_CAPITAL } from './state.js';
import { addDateRangeRow } from './utils.js';
import * as api from './api.js';

// --- DOM Element References ---
export const dom = {
    portfolioListContainer: document.getElementById('portfolioListContainer'),
    totalAllocationLabel: document.getElementById('totalAllocationLabel'),
    strategyModal: document.getElementById('strategyModal'),
    strategyModalTitle: document.getElementById('strategyModalTitle'),
    closeStrategyModalBtn: document.getElementById('closeStrategyModalBtn'),
    symbolInputCsv: document.getElementById('symbolInputCsv'),
    simulationSpinner: document.getElementById('simulationSpinner'),
    statusLabel: document.getElementById('statusLabel'),
    resultsSection: document.getElementById('resultsSection'),
    optimizationResultsSection: document.getElementById('optimizationResultsSection'),
    optimizationResultsContainer: document.getElementById('optimizationResultsContainer'),
    chartWrapper: document.getElementById('chartWrapper'),
    leveragePlanContainer: document.getElementById('leveragePlanContainer'),
    leveragePlanResults: document.getElementById('leveragePlanResults'),
    optimizationSpinner: document.getElementById('optimizationSpinner'),
    csvSection: document.getElementById('csvSection'),
    dataSourceTypeSelect: document.getElementById('dataSourceType'),
    symbolSearchInput: document.getElementById('symbolSearchInput'),
    symbolSearchResults: document.getElementById('symbolSearchResults'),
    addStockFromIbkrBtn: document.getElementById('addStockFromIbkrBtn'),
    addStockSpinner: document.getElementById('addStockSpinner'),
    ibkrDataSection: document.getElementById('ibkrDataSection'),
    optimizationDateRangesContainer: document.getElementById('optimizationDateRangesContainer'),
    addOptimizationDateRangeBtn: document.getElementById('addOptimizationDateRangeBtn'),
    simulationDateRangesContainer: document.getElementById('simulationDateRangesContainer'),
    addSimulationDateRangeBtn: document.getElementById('addSimulationDateRangeBtn'),
    fileInput: document.getElementById('fileInput'),
    interestRateFileInput: document.getElementById('interestRateFileInput'),
    runOptimizationBtn: document.getElementById('runOptimizationBtn'),
    runSimulationBtn: document.getElementById('runSimulationBtn'),
    hypotheticalInterestRateInput: document.getElementById('hypotheticalInterestRate'),
    includeInterestCheckbox: document.getElementById('includeInterest'),
    calculateAndShowBtn: document.getElementById('calculateAndShowBtn'),
    manualShowBtn: document.getElementById('manualShowBtn'),
    generatePlanFromSelectionBtn: document.getElementById('generatePlanFromSelectionBtn'),
    calculateLeveragePlanBtn: document.getElementById('calculateLeveragePlanBtn'),
    optimizationUseGlobalHighCheckbox: document.getElementById('optimizationUseGlobalHigh'),
    simulationUseGlobalHighCheckbox: document.getElementById('simulationUseGlobalHigh'),
    actionPlanSection: document.getElementById('actionPlanSection'),
    actionPlanInputs: document.getElementById('actionPlanInputs'),
    currentDebtInput: document.getElementById('currentDebtInput'),
    generateActionPlanBtn: document.getElementById('generateActionPlanBtn'),
    actionPlanResults: document.getElementById('actionPlanResults'),
    actionPlanSpinner: document.getElementById('actionPlanSpinner'),
    marginCallThreshold: document.getElementById('marginCallThreshold'),
    numRecommendations: document.getElementById('numRecommendations'),
    minDipFilter: document.getElementById('minDipFilter'),
    maxDipFilter: document.getElementById('maxDipFilter'),
    minSpreadFilter: document.getElementById('minSpreadFilter'),
    worstCaseDipInput: document.getElementById('worstCaseDipInput'),
    maxLeverageAtWorstCaseInput: document.getElementById('maxLeverageAtWorstCaseInput'),
    trailingStopPercentInput: document.getElementById('trailingStopPercent'),
    strategyFeedback: document.getElementById('strategyFeedback'),
    // הוסף את השורות הבאות
    liveOrdersSection: document.getElementById('liveOrdersSection'),
    liveOrdersContainer: document.getElementById('liveOrdersContainer'),
};

let chartInstances = {};
let manuallySelectedDips = new Set();

// --- UI Update Functions ---
export function renderPortfolioList() {
    dom.portfolioListContainer.innerHTML = '';
    const symbols = Object.keys(state.portfolio);

    if (symbols.length === 0) {
        dom.portfolioListContainer.innerHTML = '<p class="text-center text-slate-500">התיק ריק. יש להוסיף מוצרים באמצעות הטופס למעלה.</p>';
        updateTotalAllocation();
        return;
    }

    symbols.forEach(symbol => {
        const stock = state.portfolio[symbol];
        const hasStrategy = !!stock.strategy;
        const rowDiv = document.createElement('div');
        rowDiv.className = 'grid grid-cols-12 gap-x-4 items-center bg-white p-3 rounded-lg border';
        rowDiv.innerHTML = `
            <div class="col-span-3 font-bold text-lg text-indigo-800">${symbol}</div>
            <div class="col-span-3">
                <label class="text-sm">הקצאה (%):</label>
                <input type="number" value="${stock.allocation_pct}" class="w-full allocation-input" data-symbol="${symbol}">
            </div>
            <div class="col-span-4">
                <button class="btn-secondary w-full define-strategy-btn" data-symbol="${symbol}">
                    <span class="strategy-status-icon mr-2">${hasStrategy ? '✅' : '✏️'}</span>
                    ${hasStrategy ? 'ערוך אסטרטגיה' : 'הגדר אסטרטגיה'}
                </button>
            </div>
            <div class="col-span-2 text-right">
                <button class="bg-red-200 hover:bg-red-400 text-red-800 font-bold h-8 w-8 rounded-full flex items-center justify-center p-0 remove-stock-btn" data-symbol="${symbol}">×</button>
            </div>
        `;
        dom.portfolioListContainer.appendChild(rowDiv);
    });
    updateTotalAllocation();
}

export function updateTotalAllocation() {
    const total = Object.values(state.portfolio).reduce((sum, stock) => sum + (parseFloat(stock.allocation_pct) || 0), 0);
    dom.totalAllocationLabel.textContent = `${total.toFixed(0)}%`;
    if (Math.abs(total - 100) > 0.1) {
        dom.totalAllocationLabel.classList.add('text-red-500');
        dom.totalAllocationLabel.classList.remove('text-green-600');
    } else {
        dom.totalAllocationLabel.classList.remove('text-red-500');
        dom.totalAllocationLabel.classList.add('text-green-600');
    }
}

export function toggleDataSourceView() {
    const isIbkr = dom.dataSourceTypeSelect.value === 'ibkr';
    dom.ibkrDataSection.classList.toggle('hidden', !isIbkr);
    dom.csvSection.classList.toggle('hidden', isIbkr);
}

export function populateSearchResults(contracts) {
    dom.symbolSearchResults.innerHTML = '';
    if (contracts.length === 0) {
        updateStatus('לא נמצאו תוצאות.');
        dom.symbolSearchResults.classList.add('hidden');
        return;
    }

    contracts.forEach(contract => {
        const option = document.createElement('option');
        option.value = contract.conId;

        const displaySymbol = (contract.symbol || 'N/A').toUpperCase();
        option.dataset.symbol = displaySymbol; 
        
        let secTypeInfo = contract.secType ? ` (${contract.secType})` : '';
        let exchangeInfo = (contract.exchange && contract.exchange !== 'N/A') ? ` @ ${contract.exchange}` : '';
        let companyInfo = contract.companyName ? ` (${contract.companyName})` : '';
        let currencyInfo = contract.currency ? ` [${contract.currency}]` : '';

        option.textContent = `${displaySymbol}${secTypeInfo}${exchangeInfo}${companyInfo}${currencyInfo}`;
        
        dom.symbolSearchResults.appendChild(option);
    });

    dom.symbolSearchResults.classList.remove('hidden');
    updateStatus(`נמצאו ${contracts.length} תוצאות. יש לבחור מוצר וללחוץ "הוסף".`);
}

export function clearSearchInputs() {
    dom.symbolSearchInput.value = '';
    dom.symbolSearchResults.innerHTML = '';
    dom.symbolSearchResults.classList.add('hidden');
}

// --- Modals and General UI State ---
export function updateStrategyFeedback() {
    if (!dom.trailingStopPercentInput) return;
    const trailingStopValue = parseFloat(dom.trailingStopPercentInput.value);
    if (trailingStopValue > 0) {
        dom.strategyFeedback.textContent = `מריץ אסטרטגיית לקיחת רווח נגררת של ${trailingStopValue}%.`;
    } else {
        dom.strategyFeedback.textContent = `מריץ אסטרטגיה פשוטה (מכירה ביעד קבוע).`;
    }
}

export function showStrategyModal(symbol) {
    dom.strategyModalTitle.textContent = `ניתוח ובניית אסטרטגיה עבור: ${symbol.toUpperCase()}`;
    hideElement(dom.optimizationResultsSection);
    dom.optimizationResultsContainer.innerHTML = '';
    hideElement(dom.leveragePlanContainer);
    dom.leveragePlanResults.innerHTML = '';
    manuallySelectedDips.clear();
    updateStrategyFeedback();
    dom.strategyModal.classList.remove('hidden');
}

export function hideStrategyModal() {
    dom.strategyModal.classList.add('hidden');
    state.currentlyEditingSymbol = null;
}

export function toggleButtonLoading(button, isLoading, spinnerId) {
    button.disabled = isLoading;
    const spinner = document.getElementById(spinnerId);
    if (spinner) {
        spinner.classList.toggle('hidden', !isLoading);
    }
}

export function updateStatus(message) {
    dom.statusLabel.textContent = message;
    dom.statusLabel.classList.remove('text-red-600');
}

export function showError(message, elementId = 'statusLabel') {
    const element = document.getElementById(elementId);
    if (element) {
        // For the main status label, just show the text in red.
        if (elementId === 'statusLabel') {
            element.textContent = `שגיאה: ${message}`;
            element.classList.add('text-red-600');
            // Ensure no other color classes are active.
            // If you use other colors for info/success, add them here.
            // element.classList.remove('text-blue-600', 'text-green-600');
        } else {
             // For other sections (like action plan), render a full error box.
             element.innerHTML = `<div class="p-4 text-center text-red-800 bg-red-100 border border-red-400 rounded-lg"><h4 class="font-bold">שגיאה</h4><p class="mt-2">${message}</p></div>`;
        }
    }
    // As a fallback for developers, log the error to the console.
    console.error(`UI Error: ${message}`);
}

export function hideElement(element) {
    if (element) element.classList.add('hidden');
}

export function showElement(element) {
    if (element) element.classList.remove('hidden');
}

export function clearResults() {
    dom.resultsSection.innerHTML = '';
    hideElement(dom.resultsSection);
    hideElement(dom.actionPlanSection);
    Object.values(chartInstances).forEach(chart => chart.destroy());
    chartInstances = {};
}

// --- Simulation Results Display ---
export function renderSimulationResults(allResults) {
    showElement(dom.resultsSection);
    allResults.forEach((results, index) => {
        const range = results.range;
        const title = `תוצאות סימולציה: ${new Date(range.start).toLocaleDateString('he-IL')} - ${new Date(range.end).toLocaleDateString('he-IL')}`;
        appendSingleSimulationResult(results, title, index);
    });
}

function appendSingleSimulationResult(results, title, index) {
    const resultId = `sim-result-${index}-${Date.now()}`;
    const portfolioChartId = `portfolioChart-${resultId}`;
    const compositionChartId = `compositionChart-${resultId}`;
    const resultWrapper = document.createElement('div');
    resultWrapper.className = 'card';

    let marginCallHtml = results.summary.marginCalled ?
        `<div class="p-4 mb-4 text-lg font-bold text-center text-red-800 bg-red-100 border border-red-400 rounded-lg">🚨 קריאת ביטחון (Margin Call)! התיק אופס.</div>` : '';

    resultWrapper.innerHTML = `
        <h2 class="text-2xl font-bold text-center text-indigo-700 mb-6">${title}</h2>
        ${marginCallHtml}
        <div id="summaryText-${resultId}" class="mb-6"></div>
        <div class="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div>
                <h3 class="text-xl font-bold text-center text-indigo-700 mb-4">ביצועי התיק לאורך זמן</h3>
                <div style="position: relative; height:400px;"><canvas id="${portfolioChartId}"></canvas></div>
            </div>
            <div>
                <h3 class="text-xl font-bold text-center text-indigo-700 mb-4">הרכב נכסים</h3>
                <div style="position: relative; height:400px;"><canvas id="${compositionChartId}"></canvas></div>
            </div>
        </div>
    `;
    dom.resultsSection.appendChild(resultWrapper);

    const summaryElement = document.getElementById(`summaryText-${resultId}`);
    populateSummaryText(summaryElement, results);

    if (results.history.length > 0) {
        createPortfolioChart(results.history, portfolioChartId);
        createCompositionChart(results.history, compositionChartId);
    }
}

function populateSummaryText(element, results) {
    if(results.history.length === 0) return;
    const finalState = results.history[results.history.length - 1];
    const startBH = results.history[0].bhValue;
    const endBH = finalState.bhValue;
    const startEquity = INITIAL_CAPITAL;
    const endEquity = finalState.equity;
    const years = (new Date(finalState.date) - new Date(results.history[0].date)) / (1000 * 60 * 60 * 24 * 365.25);

    const formatPct = (v) => v.toFixed(2) + '%';
    const formatCurrency = (v) => '$' + v.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
    const posNegColor = (v) => v >= 0 ? 'text-green-600' : 'text-red-600';
    const calcCAGR = (start, end, years) => (years > 0 && start > 0) ? ((Math.pow(end / start, 1 / years) - 1) * 100) : 0;

    const strategyCAGR = calcCAGR(startEquity, endEquity, years);
    const bhCAGR = calcCAGR(startBH, endBH, years);

    element.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 p-4 bg-indigo-50 rounded-md text-slate-700">
            <div>
                <h3 class="text-lg font-bold text-indigo-700 border-b pb-2 mb-3">סיכום האסטרטגיה</h3>
                <p><strong>הון התחלתי:</strong> ${formatCurrency(startEquity)}</p>
                <p><strong>הון סופי:</strong> ${formatCurrency(endEquity)}</p>
                <p><strong>חוב סופי:</strong> <span class="font-bold text-orange-600">${formatCurrency(finalState.debt)}</span></p>
                <p><strong>שווי נכסים סופי:</strong> ${formatCurrency(finalState.totalValue)}</p>
                <p><strong>תשואה שנתית ממוצעת:</strong> <span class="font-bold text-xl ${posNegColor(strategyCAGR)}">${formatPct(strategyCAGR)}</span></p>
                <p><strong>קריאות ביטחון (Margin Calls):</strong> <span class="font-bold ${results.summary.marginCallCount > 0 ? 'text-red-600' : 'text-green-600'}">${results.summary.marginCallCount}</span></p>
            </div>
            <div>
                <h3 class="text-lg font-bold text-gray-700 border-b pb-2 mb-3">השוואה לאסטרטגיית "קנה והחזק"</h3>
                <p><strong>שווי התחלתי:</strong> ${formatCurrency(startBH)}</p>
                <p><strong>שווי סופי:</strong> ${formatCurrency(endBH)}</p>
                <p><strong>תשואה שנתית ממוצעת:</strong> <span class="font-bold text-xl ${posNegColor(bhCAGR)}">${formatPct(bhCAGR)}</span></p>
            </div>
        </div>
    `;
}

// --- Charting Functions ---
function createPortfolioChart(history, canvasId) {
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
    const ctx = document.getElementById(canvasId).getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => new Date(h.date)),
            datasets: [{
                label: 'שווי נכסים (אסטרטגיה)',
                data: history.map(h => h.totalValue),
                borderColor: '#16a34a',
                tension: 0.1,
                pointRadius: 0,
                borderWidth: 2,
                fill: false
            }, {
                label: 'הון עצמי (אסטרטגיה)',
                data: history.map(h => h.equity),
                borderColor: '#4f46e5',
                tension: 0.1,
                pointRadius: 0,
                borderWidth: 2,
                fill: {
                    target: 'origin',
                    above: 'rgba(79, 70, 229, 0.1)'
                }
            }, {
                label: 'קנה והחזק',
                data: history.map(h => h.bhValue),
                borderColor: '#64748b',
                tension: 0.1,
                pointRadius: 0,
                borderWidth: 2,
                borderDash: [5, 5]
            }, ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { type: 'time', time: { unit: 'year' }, },
                y: { ticks: { callback: (v) => '$' + v.toLocaleString(), }, title: { display: true, text: 'שווי ($)' } }
            },
        }
    });
}

function createCompositionChart(history, canvasId) {
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
    const ctx = document.getElementById(canvasId).getContext('2d');
    const symbols = Object.keys(history[0].composition);
    const colors = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#facc15', '#14b8a6'];
    const datasets = symbols.map((symbol, index) => ({
        label: symbol,
        data: history.map(h => h.composition[symbol]),
        backgroundColor: colors[index % colors.length] + 'B3',
        borderColor: colors[index % colors.length],
        pointRadius: 0,
        borderWidth: 1,
        fill: true
    }));
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => new Date(h.date)),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { type: 'time', time: { unit: 'year' } },
                y: { stacked: true, ticks: { callback: (v) => '$' + v.toLocaleString() }, title: { display: true, text: 'שווי נכסים ($)' } }
            },
        }
    });
}

function createOptimizationBarChart(results, canvasId) {
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
    const filteredData = results.filter(d => d.avg_closed_trades > 0 || d.avg_net_profit_after_interest !== 0);
    if (!document.getElementById(canvasId)) {
        dom.chartWrapper.innerHTML = `<canvas id="${canvasId}"></canvas>`;
    }
    if (filteredData.length === 0) {
        dom.chartWrapper.innerHTML = '<p class="text-center text-slate-500 font-semibold p-8">לא נמצאו ספים פעילים עבור התקופה שנבחרה.</p>';
        return;
    }
    const chart = new Chart(document.getElementById(canvasId).getContext('2d'), {
        type: 'bar',
        data: {
            labels: filteredData.map(d => `${d.dip_pct}%`),
            datasets: [{
                label: 'רווח נקי ממוצע',
                data: filteredData.map(d => d.avg_net_profit_after_interest),
                backgroundColor: context => {
                    const dip = filteredData[context.dataIndex].dip_pct;
                    return manuallySelectedDips.has(dip) ? '#2563eb' : (context.raw >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)');
                },
                borderColor: context => {
                    const dip = filteredData[context.dataIndex].dip_pct;
                    return manuallySelectedDips.has(dip) ? '#1d4ed8' : (context.raw >= 0 ? 'rgb(22, 163, 74)' : 'rgb(220, 38, 38)');
                },
                borderWidth: context => manuallySelectedDips.has(filteredData[context.dataIndex].dip_pct) ? 2 : 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const dip = filteredData[index].dip_pct;
                    manuallySelectedDips.has(dip) ? manuallySelectedDips.delete(dip) : manuallySelectedDips.add(dip);
                    chart.update();
                }
            },
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: false, title: { display: true, text: 'רווח נקי ממוצע ($)'} },
                x: { title: { display: true, text: 'סף ירידה מהשיא (%)' } }
            }
        }
    });
    chartInstances[canvasId] = chart;
}

// --- Optimization and Leverage Plan UI ---
export function displayOptimizationResults(results) {
    hideElement(dom.optimizationSpinner);
    showElement(dom.optimizationResultsSection);
    dom.optimizationResultsContainer.innerHTML = '';
    hideElement(dom.leveragePlanContainer);
    manuallySelectedDips.clear();
    createOptimizationBarChart(results, 'optimizationBarChart');
}

export function updateSelectedDipsFromFilters(shouldCalculateDistance) {
    let filters = getRecommendationFilters();
    if (shouldCalculateDistance) {
        if (filters.numRecs <= 0) {
            showError("מספר ההמלצות חייב להיות גדול מאפס.");
            return [];
        }
        if (filters.maxDip <= filters.minDip) {
            showError("הסף המקסימלי חייב להיות גדול מהסף המינימלי.");
            return [];
        }
        const calculatedDistance = (filters.maxDip - filters.minDip) / filters.numRecs;
        dom.minSpreadFilter.value = Math.max(0.1, calculatedDistance).toFixed(1);
        filters = getRecommendationFilters();
    }
    let filteredResults = state.lastAveragedResults.filter(r => r.dip_pct >= filters.minDip && r.dip_pct <= filters.maxDip);
    filteredResults.sort((a, b) => b.avg_net_profit_after_interest - a.avg_net_profit_after_interest);
    const topSpreadOutResults = [];
    const selectedDipsSet = new Set();
    for (const result of filteredResults) {
        if (topSpreadOutResults.length >= filters.numRecs) break;
        if (result.avg_net_profit_after_interest <= 0) continue;
        let isTooClose = Array.from(selectedDipsSet).some(dip => Math.abs(result.dip_pct - dip) < filters.minSpread);
        if (!isTooClose) {
            topSpreadOutResults.push(result);
            selectedDipsSet.add(result.dip_pct);
        }
    }
    manuallySelectedDips.clear();
    topSpreadOutResults.forEach(r => manuallySelectedDips.add(r.dip_pct));
    const chart = chartInstances['optimizationBarChart'];
    if (chart) {
        chart.update();
    }
    dom.optimizationResultsContainer.innerHTML = '';
    hideElement(dom.leveragePlanContainer);
    return topSpreadOutResults;
}

export function getSelectedDipResults() {
     if (manuallySelectedDips.size === 0) {
        return [];
     }
    const selectedResults = state.lastAveragedResults.filter(r => manuallySelectedDips.has(r.dip_pct));
    selectedResults.sort((a, b) => a.dip_pct - b.dip_pct);
    return selectedResults;
}

export function displayRecommendations(recommendationList, title) {
    dom.optimizationResultsContainer.innerHTML = '';
    dom.leveragePlanResults.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'mb-8';
    container.innerHTML = `<h3 class="text-xl font-semibold mb-3 text-indigo-600">${title}</h3>`;
    if (recommendationList.length === 0) {
        container.innerHTML += '<p class="text-center font-semibold p-4">אין המלצות התואמות את הקריטריונים.</p>';
        dom.optimizationResultsContainer.appendChild(container);
        hideElement(dom.leveragePlanContainer);
        return;
    }
    const table = document.createElement('table');
    const thead = `<thead><tr><th>סף קנייה (%)</th><th>רווח נקי ממוצע ($)</th><th>עסקאות בממוצע</th><th>משך ממוצע (ימים)</th><th>משקל יחסי (%)</th></tr></thead>`;
    let tbodyHTML = '';
    recommendationList.forEach(row => {
        tbodyHTML += `
            <tr>
                <td>${row.dip_pct.toFixed(0)}</td>
                <td class="font-bold ${row.avg_net_profit > 0 ? 'text-green-600' : 'text-red-600'}">$${row.avg_net_profit.toFixed(2)}</td>
                <td>${row.avg_closed_trades.toFixed(1)}</td>
                <td>${row.avg_duration.toFixed(1)}</td>
                <td class="font-bold text-indigo-600">${row.relative_weight_pct.toFixed(2)}%</td>
            </tr>`;
    });
    table.innerHTML = thead + `<tbody>${tbodyHTML}</tbody>`;
    container.appendChild(table);
    dom.optimizationResultsContainer.appendChild(container);
    showElement(dom.leveragePlanContainer);
}

export function displayLeveragePlan(results) {
    dom.leveragePlanResults.innerHTML = '';
    const { plan, totalLoan, finalLeverageAtLastBuy, safetyDipRatio, safetyLeverageRatio } = results;
    const diagnosticsDiv = document.createElement('div');
    const formatPct = (v) => (v * 100).toFixed(0) + '%';
    diagnosticsDiv.className = 'info-box text-sm';
    diagnosticsDiv.innerHTML = `
        <h4 class="font-bold text-indigo-700 mb-2">ניתוח התוכנית</h4>
        <p>כדי לעמוד במגבלת הסיכון שלך (לא יותר מ-<strong>${formatPct(safetyLeverageRatio)}</strong> מינוף בירידה של <strong>${formatPct(safetyDipRatio)}</strong>), סכום ההלוואה הבטוח המקסימלי הוא <span class="font-bold text-green-600">$${totalLoan.toFixed(2)}</span> (לכל 100$ של הון עצמי).</p>
        <p class="mt-2"><strong>משמעות:</strong> בסף הקנייה האחרון שלך (${(state.lastOptimizationRecommendations.length > 0 ? state.lastOptimizationRecommendations[state.lastOptimizationRecommendations.length-1].dip_pct : 0)}%), המינוף שלך יגיע ל-<strong>${finalLeverageAtLastBuy.toFixed(0)}%</strong>.</p>
    `;
    dom.leveragePlanResults.appendChild(diagnosticsDiv);
    const container = document.createElement('div');
    container.innerHTML = `<h3 class="text-xl font-semibold mb-3 text-indigo-600">תוכנית המינוף שחושבה</h3>`;
    const table = document.createElement('table');
    let tbodyHTML = '';
    plan.forEach(step => {
        tbodyHTML += `
            <tr>
                <td>${step.dip_pct.toFixed(0)}</td>
                <td>$${step.loan_amount.toFixed(2)}</td>
                <td>${step.loan_pct.toFixed(2)}%</td>
                <td class="font-bold">${step.leverage_pct.toFixed(0)}%</td>
            </tr>`;
    });
    table.innerHTML = `<thead><tr><th>סף קנייה (%)</th><th>סכום הלוואה ($)</th><th>% מסך ההלוואה</th><th>מינוף יעד (%)</th></tr></thead><tbody>${tbodyHTML}</tbody>`;
    container.appendChild(table);
    const applyPlanBtn = document.createElement('button');
    applyPlanBtn.className = 'btn-success mt-4 w-full text-lg';
    applyPlanBtn.textContent = `שמור אסטרטגיה זו עבור ${state.currentlyEditingSymbol}`;
    applyPlanBtn.onclick = () => {
        const trailingStopPercent = parseFloat(dom.trailingStopPercentInput.value) / 100.0;
        const strategy = {
            buyThresholds: {},
            targetLeverages: {},
            // ** UPDATED TO SAVE THE NEW PARAMETER **
            trailingStopPercent: isNaN(trailingStopPercent) ? 0 : trailingStopPercent,
        };
        plan.forEach(step => {
            const dipPctStr = step.dip_pct.toFixed(0);
            strategy.buyThresholds[dipPctStr] = step.dip_pct / 100.0;
            strategy.targetLeverages[dipPctStr] = step.leverage_pct / 100.0;
        });
        setStrategyForSymbol(state.currentlyEditingSymbol, strategy);
        updateStatus(`אסטרטגיה עבור ${state.currentlyEditingSymbol} נשמרה.`);
        renderPortfolioList();
        hideStrategyModal();
    };
    container.appendChild(applyPlanBtn);
    dom.leveragePlanResults.appendChild(container);
}

// --- Action Plan UI ---
export function renderActionPlanUI() {
    dom.actionPlanInputs.innerHTML = '';
    const symbols = Object.keys(state.portfolio);
    if (symbols.length === 0) return;
    showElement(dom.actionPlanSection);
    const table = document.createElement('table');
    let tbodyHTML = '';
    symbols.forEach(symbol => {
        tbodyHTML += `
            <tr>
                <td class="font-bold text-indigo-800">${symbol}</td>
                <td><input type="number" class="w-full text-center action-plan-shares" data-symbol="${symbol}" placeholder="יש להזין כמות נוכחית"></td>
            </tr>
        `;
    });
    table.innerHTML = `<thead><tr><th>סימבול</th><th>כמות מניות נוכחית</th></tr></thead><tbody>${tbodyHTML}</tbody>`;
    dom.actionPlanInputs.appendChild(table);
}

export function displayActionPlan(plan) {
    const { currentEquity, currentLeverage, targetLeverage, triggeringSymbol, triggeringDip, amountToInvestOrDivest, priceOfTriggeringSymbol } = plan;
    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    
    let summaryHTML = `
        <h3 class="text-xl font-semibold mb-3 text-indigo-600">ניתוח מצב נוכחי</h3>
        <div class="grid grid-cols-2 gap-4 text-center mb-6">
            <div class="bg-slate-100 p-3 rounded-lg"><p class="text-sm text-slate-600">הון עצמי נוכחי</p><p class="font-bold text-2xl">${formatCurrency(currentEquity)}</p></div>
            <div class="bg-slate-100 p-3 rounded-lg"><p class="text-sm text-slate-600">מינוף נוכחי</p><p class="font-bold text-2xl">${(currentLeverage * 100).toFixed(0)}%</p></div>
            <div class="bg-slate-100 p-3 rounded-lg"><p class="text-sm text-slate-600">מינוף יעד</p><p class="font-bold text-2xl text-green-600">${(targetLeverage * 100).toFixed(0)}%</p></div>
            <div class="bg-slate-100 p-3 rounded-lg"><p class="text-sm text-slate-600">טריגר</p><p class="font-bold text-2xl text-green-600">${triggeringSymbol} @ ${triggeringDip}%</p></div>
        </div>
    `;
    
    let recommendationHTML = '';
    if (amountToInvestOrDivest > 1) {
        const sharesToBuy = amountToInvestOrDivest / priceOfTriggeringSymbol;
        recommendationHTML = `
            <div class="p-4 text-center text-green-800 bg-green-100 border border-green-400 rounded-lg">
                <h4 class="font-bold text-lg">המלצה: הגדל מינוף</h4>
                <p class="mt-2">המינוף המיועד גבוה מהמינוף הנוכחי. מומלץ <strong>ללוות ${formatCurrency(amountToInvestOrDivest)} נוספים</strong> ולהשתמש בהם כדי <strong>לקנות כ-${sharesToBuy.toFixed(2)} מניות של ${triggeringSymbol}</strong>.</p>
            </div>`;
    } else if (amountToInvestOrDivest < -1) {
        const amountToDivest = Math.abs(amountToInvestOrDivest);
        recommendationHTML = `
            <div class="p-4 text-center text-orange-800 bg-orange-100 border border-orange-400 rounded-lg">
                <h4 class="font-bold text-lg">המלצה: הקטן מינוף</h4>
                <p class="mt-2">המינוף הנוכחי גבוה מהמטרה. מומלץ לשקול <strong>מכירת נכסים בשווי ${formatCurrency(amountToDivest)}</strong> כדי להקטין את החוב ולהגיע למינוף היעד.</p>
            </div>`;
    } else {
        recommendationHTML = `
            <div class="p-4 text-center text-blue-800 bg-blue-100 border border-blue-400 rounded-lg">
                <h4 class="font-bold text-lg">המלצה: אין צורך בפעולה</h4>
                <p class="mt-2">התיק שלך מאוזן בהתאם לאסטרטגיה שהוגדרה. המינוף הנוכחי תואם את היעד.</p>
            </div>`;
    }

    let executionHTML = `<div id="execution-section" class="mt-4 text-center"></div>`;
    dom.actionPlanResults.innerHTML = summaryHTML + recommendationHTML + executionHTML;
    
    const executionSection = document.getElementById('execution-section');
    
    if (Math.abs(amountToInvestOrDivest) > 1 && priceOfTriggeringSymbol > 0) {
        const action = plan.amountToInvestOrDivest > 0 ? 'BUY' : 'SELL';
        const quantity = Math.abs(plan.amountToInvestOrDivest / plan.priceOfTriggeringSymbol);
        
        const secType = state.portfolio[plan.triggeringSymbol]?.secType || 'STK';

        const executeBtn = document.createElement('button');
        executeBtn.id = 'execute-order-btn';
        executeBtn.className = action === 'BUY' ? 'btn-success text-lg' : 'btn-primary text-lg';
        executeBtn.textContent = `בצע פקודת מרקט ${action === 'BUY' ? 'קנייה' : 'מכירה'}`;
        
        executeBtn.dataset.symbol = plan.triggeringSymbol;
        executeBtn.dataset.action = action;
        executeBtn.dataset.quantity = quantity.toFixed(4);
        executeBtn.dataset.secType = secType;
        
        executionSection.appendChild(executeBtn);

        executeBtn.addEventListener('click', handleExecuteOrder);
    }
}

async function handleExecuteOrder(event) {
    const btn = event.currentTarget;
    const { symbol, action, quantity, secType } = btn.dataset;

    const finalQuantity = Math.floor(parseFloat(quantity));

    if (finalQuantity < 1) {
        showError("לא ניתן לבצע פקודה על פחות מיחידה אחת.", 'actionPlanResults');
        return;
    }
    
    const hebrewAction = action === 'BUY' ? 'קנייה' : 'מכירה';
    if (!confirm(`האם אתה בטוח שברצונך לשלוח פקודת MARKET ${hebrewAction} עבור ${finalQuantity} יחידות של ${symbol}?`)) {
        return;
    }

    toggleButtonLoading(btn, true, 'actionPlanSpinner');
    updateStatus(`שולח פקודת ${hebrewAction} עבור ${symbol}...`);

    try {
        const orderDetails = {
            symbol,
            action,
            quantity: finalQuantity,
            secType,
            orderType: 'MKT',
        };
        
        const result = await api.placeOrder(orderDetails);
        
        updateStatus(`הפקודה נשלחה בהצלחה! מזהה: ${result.orderId}. ניתן לעקוב אחר הסטטוס בטבלת הפקודות החיות.`);
        
        btn.disabled = true;
        btn.textContent = 'פקודה נשלחה';

    } catch (error) {
        showError(error.message, 'actionPlanResults');
        updateStatus(`שגיאה בשליחת הפקודה: ${error.message}`);
    } finally {
        toggleButtonLoading(btn, false, 'actionPlanSpinner');
    }
}

// Add Event Listener for the new cancel buttons, using event delegation
dom.liveOrdersContainer.addEventListener('click', async (event) => {
    if (event.target.classList.contains('cancel-order-btn')) {
        const btn = event.target;
        const orderId = btn.dataset.orderId;
        if (!orderId) return;

        if (confirm(`האם אתה בטוח שברצונך לבטל את פקודה מספר ${orderId}?`)) {
            btn.disabled = true;
            btn.textContent = '...'; // Provide visual feedback that it's working
            try {
                const result = await api.cancelOrder(orderId);
                // The table will be updated automatically via WebSocket message.
                // We just show a status message to the user for immediate feedback.
                updateStatus(result.message);
            } catch (error) {
                // If the API call fails, show an error and re-enable the button.
                showError(`ביטול פקודה ${orderId} נכשל: ${error.message}`);
                btn.disabled = false; 
                btn.textContent = 'בטל';
            }
        }
    }
});

// --- Live Order Table Management ---

// מאגר פנימי שיחזיק את מצב הפקודות ב-UI
const liveOrdersState = new Map();

/**
 * Updates a single order in the state and re-renders the order table.
 * @param {object} orderData - The updated order data from the server.
 */
export function updateLiveOrder(orderData) {
    if (!orderData || typeof orderData.id === 'undefined') return;
    liveOrdersState.set(orderData.id, orderData);
    renderLiveOrdersTable();
}

/**
 * Replaces all live orders with a new list and re-renders the table.
 * @param {Array<object>} allOrders - An array of all orders from the server.
 */
export function setAllLiveOrders(allOrders) {
    liveOrdersState.clear();
    if (Array.isArray(allOrders)) {
        allOrders.forEach(order => {
            if (order && typeof order.id !== 'undefined') {
                liveOrdersState.set(order.id, order);
            }
        });
    }
    renderLiveOrdersTable();
}

/**
 * Renders the live orders table based on the current state in liveOrdersState.
 */
function renderLiveOrdersTable() {
    if (!dom.liveOrdersSection || !dom.liveOrdersContainer) return;
    
    showElement(dom.liveOrdersSection); // Make sure the whole section is visible
    
    if (liveOrdersState.size === 0) {
        dom.liveOrdersContainer.innerHTML = '<p class="text-center text-slate-500">לא נמצאו פקודות פעילות. פקודות חדשות יופיעו כאן באופן אוטומטי.</p>';
        return;
    }

    // Sort orders from newest to oldest
    const orders = Array.from(liveOrdersState.values()).sort((a, b) => b.id - a.id);
    
    let tableHTML = `
        <table class="w-full text-center border-collapse">
            <thead>
                <tr class="border-b-2 border-slate-300">
                    <th class="p-2">מזהה</th>
                    <th class="p-2">סימבול</th>
                    <th class="p-2">פעולה</th>
                    <th class="p-2">כמות</th>
                    <th class="p-2">סוג</th>
                    <th class="p-2">סטטוס</th>
                    <th class="p-2">בוצע</th>
                    <th class="p-2">מחיר ממוצע</th>
                    <th class="p-2">פעולות</th>
                </tr>
            </thead>
            <tbody>
    `;

    orders.forEach(order => {
        let statusColor = 'text-slate-700';
        if (order.status === 'Filled') statusColor = 'text-green-600 font-bold';
        if (order.status === 'Cancelled' || order.status === 'Inactive' || order.status === 'ApiCancelled') statusColor = 'text-red-600';
        if (order.status === 'Submitted' || order.status === 'PreSubmitted') statusColor = 'text-blue-600';

        // Determine if the order can be cancelled based on its status
        const isCancellable = !['Filled', 'Cancelled', 'Inactive', 'ApiCancelled'].includes(order.status);
        const cancelButtonHTML = isCancellable
            ? `<button class="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-2 rounded cancel-order-btn" data-order-id="${order.id}">בטל</button>`
            : '—'; // Use an em-dash for non-cancellable orders

        tableHTML += `
            <tr class="border-b border-slate-200">
                <td class="p-2">${order.id}</td>
                <td class="p-2 font-bold">${order.symbol}</td>
                <td class="p-2 font-semibold ${order.action === 'BUY' ? 'text-blue-700' : 'text-orange-600'}">${order.action}</td>
                <td class="p-2">${order.quantity}</td>
                <td class="p-2">${order.orderType} ${order.orderType === 'LMT' && order.limitPrice ? '@ ' + order.limitPrice : ''}</td>
                <td class="p-2 ${statusColor}">${order.status}</td>
                <td class="p-2">${order.filled} / ${order.quantity}</td>
                <td class="p-2">${order.avgFillPrice > 0 ? order.avgFillPrice.toFixed(2) : '-'}</td>
                <td class="p-2">${cancelButtonHTML}</td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    dom.liveOrdersContainer.innerHTML = tableHTML;
}

// --- Input Getters ---
export function getSimulationParameters() {
    const symbols = Object.keys(state.portfolio);
    if (symbols.length === 0) throw new Error("התיק ריק. אנא הוסף מוצרים תחילה.");
    const totalAllocation = symbols.reduce((sum, s) => sum + (state.portfolio[s].allocation_pct || 0), 0);
    if (Math.abs(totalAllocation - 100) > 0.1) {
        throw new Error(`סך ההקצאה חייב להיות 100%. כרגע הוא ${totalAllocation.toFixed(1)}%.`);
    }
    for (const symbol of symbols) {
        if (!state.portfolio[symbol].strategy) throw new Error(`למוצר ${symbol} לא הוגדרה אסטרטגיה.`);
        if (!state.historicalData[symbol] || state.historicalData[symbol].length === 0) throw new Error(`למוצר ${symbol} אין מידע היסטורי טעון.`);
    }
    const dateRangeNodes = document.querySelectorAll('#simulationDateRangesContainer > div');
    const userDefinedRanges = Array.from(dateRangeNodes).map(row => {
        const start = row.querySelector('.start-date-input').value;
        const end = row.querySelector('.end-date-input').value;
        return (start && end && new Date(start) < new Date(end)) ? {
            start: new Date(start),
            end: new Date(end)
        } : null;
    }).filter(Boolean);
    if (userDefinedRanges.length === 0) {
        throw new Error("אנא הגדר לפחות טווח תאריכים אחד לסימולציה.");
    }
    return {
        portfolioConfig: state.portfolio,
        allHistoricalData: state.historicalData,
        interestData: dom.includeInterestCheckbox.checked ? state.interestRateData : [],
        userDefinedRanges,
        marginCallDebtToEquityRatio: parseFloat(dom.marginCallThreshold.value) / 100.0,
        useGlobalHigh: dom.simulationUseGlobalHighCheckbox.checked,
    };
}

export function getOptimizationParameters() {
    const symbol = state.currentlyEditingSymbol;
    if (!symbol || !state.historicalData[symbol]) {
        throw new Error("שגיאה: לא נבחר מוצר לעריכה.");
    }
    const stockData = state.historicalData[symbol];
    if (stockData.length === 0) throw new Error("אין נתונים היסטוריים עבור המוצר שנבחר.");

    // --- FIX FOR TIMEZONE ---
    const normalizeDateToUTC = (dateString) => {
        if (!dateString) return null;
        // Handles YYYY-MM-DD format from date input
        const [year, month, day] = dateString.split('-').map(Number);
        // Creates a date at the beginning of the day in UTC
        return new Date(Date.UTC(year, month - 1, day));
    };

    const dateRangeNodes = document.querySelectorAll('#optimizationDateRangesContainer > div');
    const userDefinedRanges = Array.from(dateRangeNodes).map(row => {
        const startStr = row.querySelector('.start-date-input').value;
        const endStr = row.querySelector('.end-date-input').value;
        const start = normalizeDateToUTC(startStr);
        const end = normalizeDateToUTC(endStr);
        return (start && end && start < end) ? { start, end } : null;
    }).filter(Boolean);
    // --- END OF FIX ---
    
    let rangesToProcess = userDefinedRanges.length > 0 ? userDefinedRanges : [{
        start: new Date(stockData[0].date),
        end: new Date(stockData[stockData.length - 1].date)
    }];
    if (rangesToProcess.length === 0) throw new Error("לא נמצאו נתונים או טווחי תאריכים לבדיקה.");
    
    const hypotheticalInterestRate = parseFloat(dom.hypotheticalInterestRateInput.value) / 100.0;
    if (isNaN(hypotheticalInterestRate)) throw new Error("ערך ריבית היפותטית אינו תקין.");

    const trailingStopPercent = parseFloat(dom.trailingStopPercentInput.value) / 100.0;
    if (isNaN(trailingStopPercent)) {
        console.warn("אחוז סטופ נגרר אינו תקין, ברירת המחדל תהיה 0.");
        return { stockData, rangesToProcess, useGlobalHigh: dom.optimizationUseGlobalHighCheckbox.checked, dipPctsToTest: Array.from({ length: 100 }, (_, i) => i + 1), hypotheticalInterestRate, trailingStopPercent: 0 };
    }

    return {
        stockData,
        rangesToProcess,
        useGlobalHigh: dom.optimizationUseGlobalHighCheckbox.checked,
        dipPctsToTest: Array.from({ length: 100 }, (_, i) => i + 1),
        hypotheticalInterestRate,
        trailingStopPercent,
    };
}

export function getRecommendationFilters() {
    const numRecs = parseInt(dom.numRecommendations.value) || 10;
    const minDip = parseFloat(dom.minDipFilter.value) || 1;
    const maxDip = parseFloat(dom.maxDipFilter.value) || 100;
    const minSpread = parseFloat(dom.minSpreadFilter.value) || 5;
    return { numRecs, minDip, maxDip, minSpread };
}

export function getLeveragePlanInputs() {
    const worstCaseDipRatio = parseFloat(dom.worstCaseDipInput.value) / 100;
    const maxLeverageAtWorstCaseRatio = parseFloat(dom.maxLeverageAtWorstCaseInput.value) / 100;
    const lastDip = state.lastOptimizationRecommendations.length > 0 ? state.lastOptimizationRecommendations[state.lastOptimizationRecommendations.length - 1]?.dip_pct : 0;
    if (isNaN(worstCaseDipRatio) || isNaN(maxLeverageAtWorstCaseRatio)) {
        throw new Error("ערכי מגבלת הסיכון אינם תקינים.");
    }
    if (worstCaseDipRatio <= lastDip / 100) {
        throw new Error(`ירידת התרחיש הגרוע ביותר חייבת להיות גדולה יותר מסף הקנייה האחרון (${lastDip}%).`);
    }
    return {
        initialCapital: 100,
        strategy: state.lastOptimizationRecommendations,
        safetyDipRatio: worstCaseDipRatio,
        safetyLeverageRatio: maxLeverageAtWorstCaseRatio,
    };
}

export function getActionPlanInputs() {
    const userHoldings = {};
    document.querySelectorAll('.action-plan-shares').forEach(input => {
        userHoldings[input.dataset.symbol] = parseFloat(input.value) || 0;
    });
    const currentDebt = parseFloat(dom.currentDebtInput.value) || 0;
    return { userHoldings, currentDebt };
}

// --- Local Storage ---
export function saveState() {
    try {
        const stateToSave = {
            marginCallThreshold: dom.marginCallThreshold.value,
            hypotheticalInterestRate: dom.hypotheticalInterestRateInput.value,
            trailingStopPercent: dom.trailingStopPercentInput.value,
            includeInterest: dom.includeInterestCheckbox.checked,
            optimizationUseGlobalHigh: dom.optimizationUseGlobalHighCheckbox.checked,
            simulationUseGlobalHigh: dom.simulationUseGlobalHighCheckbox.checked,
            portfolio: state.portfolio,
        };
        const serializableState = JSON.stringify(stateToSave);
        localStorage.setItem(LOCAL_STORAGE_KEY, serializableState);
    } catch (e) {
        console.error("Failed to save state:", e);
    }
}

export function loadState() {
    try {
        const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedStateJSON) {
            const savedState = JSON.parse(savedStateJSON);
            dom.marginCallThreshold.value = savedState.marginCallThreshold || "150";
            dom.hypotheticalInterestRateInput.value = savedState.hypotheticalInterestRate || 4;
            dom.trailingStopPercentInput.value = savedState.trailingStopPercent || 0;
            dom.includeInterestCheckbox.checked = savedState.includeInterest !== false;
            dom.optimizationUseGlobalHighCheckbox.checked = savedState.optimizationUseGlobalHigh !== false;
            dom.simulationUseGlobalHighCheckbox.checked = savedState.simulationUseGlobalHigh !== false;
            if (savedState.portfolio) {
                state.portfolio = savedState.portfolio;
                const symbolsWithStrategies = Object.keys(state.portfolio);
                if (symbolsWithStrategies.length > 0) {
                    updateStatus(`תיק ההשקעות נטען. חשוב: יש לטעון מחדש נתונים היסטוריים עבור כל מוצר כדי להריץ סימולציות.`);
                    state.historicalData = {};
                }
            }
        }
    } catch (e) {
        console.error("Failed to load state:", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
}