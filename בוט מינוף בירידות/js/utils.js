
/**
 * Parses a CSV file using PapaParse.
 * @param {File} file - The file object to parse.
 * @param {object} config - Configuration for parsing (required columns, row parser, etc.).
 * @returns {Promise<Array<object>>} A promise resolving to the parsed data.
 */
export function parseCsvFile(file, config) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    return reject(new Error(results.errors.map(e => e.message).join('\n')));
                }
                if (config.requiredCols) {
                    const missingCols = config.requiredCols.filter(col => !results.meta.fields.includes(col));
                    if (missingCols.length > 0) {
                        return reject(new Error(`Missing required columns: ${missingCols.join(', ')}`));
                    }
                }
                const parsedData = results.data
                    .map(config.rowParser)
                    .filter(d => d && (config.rowValidator ? config.rowValidator(d) : true));
                
                if (config.sort) {
                    parsedData.sort(config.sort);
                }
                resolve(parsedData);
            },
            error: (error) => reject(error)
        });
    });
}

/**
 * Configuration objects for different types of CSV files.
 */
export const csvConfigs = {
    stock: {
        requiredCols: ['Date', 'Open', 'High', 'Low', 'Price'],
        rowParser: row => {
            const d = new Date(row.Date);
            return {
                date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
                open: parseFloat(String(row.Open).replace(/,/g, '')),
                high: parseFloat(String(row.High).replace(/,/g, '')),
                low: parseFloat(String(row.Low).replace(/,/g, '')),
                price: parseFloat(String(row.Price).replace(/,/g, ''))
            };
        },
        rowValidator: row => !isNaN(new Date(row.Date).getTime()) && !isNaN(parseFloat(String(row.Price).replace(/,/g, ''))),
        sort: (a, b) => new Date(a.date) - new Date(b.date)
    },
    interest: {
        requiredCols: ['DATE', 'DFF'],
        rowParser: row => {
            const d = new Date(row.DATE);
            return {
                date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
                rate: parseFloat(row.DFF) / 100
            };
        },
        rowValidator: row => !isNaN(new Date(row.DATE).getTime()) && !isNaN(parseFloat(row.DFF)),
        sort: (a, b) => new Date(a.date) - new Date(b.date)
    }
};

/**
 * Adds a new date range input row to a given container element.
 * @param {HTMLElement} container - The container to append the new row to.
 * @param {string} [startDateStr=''] - The start date string (YYYY-MM-DD).
 * @param {string} [endDateStr=''] - The end date string (YYYY-MM-DD).
 */
export function addDateRangeRow(container, startDateStr = '', endDateStr = '') {
    const rowId = `date-range-${Date.now()}-${Math.random()}`;
    const rowDiv = document.createElement('div');
    rowDiv.id = rowId;
    rowDiv.className = 'grid grid-cols-11 gap-x-2 items-center';
    rowDiv.innerHTML = `
        <label class="col-span-2">Start:</label>
        <input type="date" class="col-span-3 start-date-input" value="${startDateStr}">
        <label class="col-span-2 text-center">End:</label>
        <input type="date" class="col-span-3 end-date-input" value="${endDateStr}">
    `;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '-';
    removeBtn.className = 'col-span-1 bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-full text-sm';
    removeBtn.onclick = () => document.getElementById(rowId).remove();
    rowDiv.appendChild(removeBtn);
    container.appendChild(rowDiv);
}


/**
 * Sets up the initial date ranges for both simulation and optimization sections.
 * @param {HTMLElement} optContainer - The optimization date range container.
 * @param {HTMLElement} simContainer - The simulation date range container.
 */
export function setupInitialDateRanges(optContainer, simContainer) {
    optContainer.innerHTML = '';
    simContainer.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];
    const fiveYearsAgo = new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().split('T')[0];
    addDateRangeRow(optContainer, fiveYearsAgo, today);
    addDateRangeRow(simContainer, fiveYearsAgo, today);
}