import { INITIAL_CAPITAL, state } from './state.js'; // Added 'state' to imports

/**
 * Simulates a statistical dip trading strategy for a single asset.
 * This function is robust against look-ahead bias and supports the advanced "Trailing Take Profit" strategy.
 * @param {Array<object>} data - The historical data for the asset.
 * @param {object} params - Strategy parameters { buyThreshold, hypotheticalInterestRate, trailingStopPercent }.
 * @param {number} initialRunningHigh - The running high price before the simulation starts.
 */
function simulateStatisticalDipTrading(data, params, initialRunningHigh) {
    if (data.length === 0) return { total_net_profit_after_interest: 0, closed_trades: 0, total_days_in_trades: 0 };
    
    const investmentPerTrade = 100;
    const { buyThreshold, hypotheticalInterestRate, trailingStopPercent: takeProfitDropPercent = 0 } = params;
    const useAdvancedStrategy = takeProfitDropPercent > 0;

    let totalNetProfitAfterInterest = 0,
        closedTradeCount = 0,
        totalDaysInTrades = 0;
    
    let runningHighPrice = initialRunningHigh;
    let inActiveTrade = false;
    let entryPrice = 0,
        entryDate = null;
    
    // Strategy-specific state
    let simpleStrategyTarget = 0;
    let isTakeProfitArmed = false;

    for (let i = 0; i < data.length; i++) {
        const todayData = data[i];
        
        // PART 1: MAKE DECISIONS FOR TODAY (based on T-1 data)
        if (inActiveTrade) {
            let sellSignal = false;
            let actualSellPrice = 0;

            if (useAdvancedStrategy) {
                if (!isTakeProfitArmed && todayData.high >= runningHighPrice) {
                    isTakeProfitArmed = true;
                }
                if (isTakeProfitArmed) {
                    const dynamicSellTarget = runningHighPrice * (1 - takeProfitDropPercent);
                    if (todayData.low <= dynamicSellTarget) {
                        sellSignal = true;
                        actualSellPrice = dynamicSellTarget;
                    }
                }
            } else { // Simple Strategy
                if (todayData.high >= simpleStrategyTarget) {
                    sellSignal = true;
                    actualSellPrice = simpleStrategyTarget;
                }
            }

            if (sellSignal) {
                if (entryPrice > 0) {
                    const grossProfit = (investmentPerTrade / entryPrice * actualSellPrice) - investmentPerTrade;
                    const daysInTrade = Math.max(1, (new Date(todayData.date) - entryDate) / (1000 * 60 * 60 * 24));
                    const interestCost = investmentPerTrade * hypotheticalInterestRate * (daysInTrade / 365);
                    totalNetProfitAfterInterest += (grossProfit - interestCost);
                    totalDaysInTrades += daysInTrade;
                    closedTradeCount++;
                }
                inActiveTrade = false;
                isTakeProfitArmed = false;
            }
        } else { // Not in a trade, look for a buy signal
            const entryPriceThreshold = runningHighPrice * (1 - buyThreshold);
            if (todayData.low <= entryPriceThreshold) {
                inActiveTrade = true;
                entryPrice = entryPriceThreshold;
                entryDate = new Date(todayData.date);
                if (!useAdvancedStrategy) {
                    simpleStrategyTarget = runningHighPrice;
                }
            }
        }

        // PART 2: UPDATE KNOWLEDGE FOR TOMORROW
        runningHighPrice = Math.max(runningHighPrice, todayData.high);
    }

    if (inActiveTrade && entryPrice > 0) {
        const lastPrice = data[data.length - 1].price;
        const grossProfit = (investmentPerTrade / entryPrice * lastPrice) - investmentPerTrade;
        const daysInTrade = Math.max(1, (new Date(data[data.length - 1].date) - entryDate) / (1000 * 60 * 60 * 24));
        const interestCost = investmentPerTrade * hypotheticalInterestRate * (daysInTrade / 365);
        totalNetProfitAfterInterest += (grossProfit - interestCost);
    }

    return {
        total_net_profit_after_interest: totalNetProfitAfterInterest,
        closed_trades: closedTradeCount,
        total_days_in_trades: totalDaysInTrades
    };
}


/**
 * Runs the full optimization process across all specified date ranges.
 * This version is hardened against data contamination.
 */
 
 export async function runFullOptimization(params, onProgress) {
    const { stockData, rangesToProcess, useGlobalHigh, dipPctsToTest, hypotheticalInterestRate, trailingStopPercent, symbol } = params;
    const aggregatedResults = new Map();

    for (let i = 0; i < rangesToProcess.length; i++) {
        const range = rangesToProcess[i];
        const simData = stockData.filter(row => new Date(row.date) >= range.start && new Date(row.date) <= range.end);
        if (simData.length === 0) continue;

        let initialHighForRun = useGlobalHigh ?
            (stockData.filter(d => new Date(d.date) < range.start).reduce((max, d) => Math.max(max, d.high), 0)) :
            (simData[0]?.price || 0);
        if (initialHighForRun === 0 && simData.length > 0) {
            initialHighForRun = simData[0].price;
        }
        if(initialHighForRun === 0) continue;

        // --- DATA VALIDATION BLOCK ---
        if (useGlobalHigh) {
            const dataBeforeRange = stockData.filter(d => new Date(d.date) < range.start);
            let peakDay = null;
            let peakHigh = 0;
            for (const day of dataBeforeRange) {
                if (day.high > peakHigh) {
                    peakHigh = day.high;
                    peakDay = day;
                }
            }
            console.log(`[DATA_VALIDATION] For symbol '${symbol}', the highest peak before the range was ${peakHigh} on date:`, peakDay?.date.toLocaleDateString());
        }
        // --- END OF VALIDATION BLOCK ---

        for (const dip of dipPctsToTest) {
            onProgress(`Processing range ${i+1}/${rangesToProcess.length}... (Threshold ${dip}%)`);
            await new Promise(resolve => setTimeout(resolve, 0));
            
            const results = simulateStatisticalDipTrading(simData, {
                buyThreshold: dip / 100.0,
                hypotheticalInterestRate: hypotheticalInterestRate,
                trailingStopPercent: trailingStopPercent 
            }, initialHighForRun);

            if (!aggregatedResults.has(dip)) {
                aggregatedResults.set(dip, {
                    run_count: 0,
                    total_net_profit_after_interest: 0,
                    total_closed_trades: 0,
                    total_days_in_trades: 0
                });
            }
            const entry = aggregatedResults.get(dip);
            entry.run_count++;
            entry.total_net_profit_after_interest += results.total_net_profit_after_interest;
            entry.total_closed_trades += results.total_closed_trades;
            entry.total_days_in_trades += results.total_days_in_trades;
        }
    }

    return Array.from(aggregatedResults.entries()).map(([dip_pct, totals]) => ({
        dip_pct,
        avg_net_profit_after_interest: totals.total_net_profit_after_interest / totals.run_count,
        avg_closed_trades: totals.total_closed_trades / totals.run_count,
        avg_total_days: totals.total_days_in_trades > 0 ? totals.total_days_in_trades / totals.run_count : 0,
    }));
}


/**
 * Simulates the full portfolio strategy over a given period.
 * This version correctly implements both scaling-in and deleveraging logic.
 */
export function simulatePortfolioStrategy(params) {
    const { portfolioConfig, allHistoricalData, interestData, range, marginCallDebtToEquityRatio, useGlobalHigh } = params;
    const symbols = Object.keys(portfolioConfig);
    const dataMaps = {};
    let commonDatesSet;

    // --- Data Preparation ---
    const normalizeDate = (d) => {
        const date = new Date(d);
        date.setUTCHours(0, 0, 0, 0);
        return date.getTime();
    };

    const normalizedHistoricalData = {};
    for (const symbol in allHistoricalData) {
        normalizedHistoricalData[symbol] = allHistoricalData[symbol].map(d => ({...d, date: new Date(d.date) }));
    }
    const normalizedInterestData = interestData.map(d => ({...d, date: new Date(d.date)}));

    for (const symbol of symbols) {
        const stockData = normalizedHistoricalData[symbol].filter(d => d.date >= range.start && d.date <= range.end);
        if (stockData.length === 0) throw new Error(`No data for ${symbol} in the selected date range.`);
        const dateSet = new Set(stockData.map(d => normalizeDate(d.date)));
        if (!commonDatesSet) {
            commonDatesSet = dateSet;
        } else {
            commonDatesSet = new Set([...commonDatesSet].filter(ts => dateSet.has(ts)));
        }
        dataMaps[symbol] = new Map(stockData.map(d => [normalizeDate(d.date), d]));
    }

    const commonDates = Array.from(commonDatesSet).sort().map(ts => new Date(ts));
    if (commonDates.length === 0) throw new Error("No common trading days for all products in the selected range.");

    const interestMap = new Map(normalizedInterestData.map(d => [normalizeDate(d.date), d.rate]));

    // --- State Initialization ---
    let simState = {
        equity: INITIAL_CAPITAL,
        debt: 0,
        holdings: {},
        runningHighs: {},
        // --- NEW AND IMPROVED STATE MANAGEMENT ---
        debtBySymbol: {},        // Tracks debt per asset
        lastBuyDip: {},          // Tracks the last dip level bought for each asset
        isTakeProfitArmed: {},   // Tracks the trailing stop state per asset
    };
    let buyAndHoldState = {
        totalValue: INITIAL_CAPITAL,
        holdings: {}
    };

    const firstDateTs = normalizeDate(commonDates[0]);
    for (const symbol of symbols) {
        const firstDayData = dataMaps[symbol].get(firstDateTs);
        const allocationAmount = INITIAL_CAPITAL * (portfolioConfig[symbol].allocation_pct / 100);
        simState.holdings[symbol] = {
            units: allocationAmount / firstDayData.price,
        };
        simState.runningHighs[symbol] = useGlobalHigh ?
            (normalizedHistoricalData[symbol].filter(d => d.date < range.start).reduce((max, d) => Math.max(max, d.high), 0)) :
            (firstDayData?.price || 0);
        if (simState.runningHighs[symbol] === 0 && normalizedHistoricalData[symbol].length > 0) {
            simState.runningHighs[symbol] = normalizedHistoricalData[symbol][0].price;
        }
        
        // Initialize state for each symbol
        simState.debtBySymbol[symbol] = 0;
        simState.lastBuyDip[symbol] = 0;
        simState.isTakeProfitArmed[symbol] = false;
        
        buyAndHoldState.holdings[symbol] = {
            units: allocationAmount / firstDayData.price,
        };
    }

    const history = [];
    let marginCalled = false;
    let marginCallCount = 0;

    // --- Main Simulation Loop ---
    for (const date of commonDates) {
        if (marginCalled) {
            history.push({ ...history[history.length - 1], date: date });
            continue;
        }

        const todayTs = normalizeDate(date);
        
        // ==================================================================
        // PART 1: MAKE DECISIONS FOR TODAY (BUY and SELL logic runs independently)
        // ==================================================================
        
        for (const symbol of symbols) {
            const todayData = dataMaps[symbol].get(todayTs);
            if (!todayData) continue;
            
            const strategy = portfolioConfig[symbol].strategy;
            if (!strategy) continue;

            const runningHighForDecision = simState.runningHighs[symbol];
            
            // Flag to track if a sell occurred for this symbol today
            let soldToday = false; // <--- ADDED FLAG

            // --- SELL LOGIC (DELEVERAGING) ---
            // Only consider selling if there is a specific debt for this symbol
            if (simState.debtBySymbol[symbol] > 0) {
                const takeProfitDropPercent = strategy.trailingStopPercent || 0;
                let sellSignal = false;
                let sellPrice = 0;

                if (takeProfitDropPercent > 0) { // Advanced Trailing Stop
                    if (!simState.isTakeProfitArmed[symbol] && todayData.high >= runningHighForDecision) {
                        simState.isTakeProfitArmed[symbol] = true;
                    }
                    if (simState.isTakeProfitArmed[symbol]) {
                        const dynamicSellTarget = runningHighForDecision * (1 - takeProfitDropPercent);
                        if (todayData.low <= dynamicSellTarget) {
                            sellSignal = true;
                            sellPrice = dynamicSellTarget;
                        }
                    }
                } else { // Simple "sell at peak" strategy
                    if (todayData.high >= runningHighForDecision) {
                        sellSignal = true;
                        sellPrice = runningHighForDecision;
                    }
                }
                
                if (sellSignal) {
                    const debtToRepay = simState.debtBySymbol[symbol];
                    // Check if we have enough units to sell to cover this debt part
                    // Avoid selling more than we have, although debtToRepay should ideally not exceed position value in typical scenarios
                    const unitsToSell = Math.min(simState.holdings[symbol].units, debtToRepay / sellPrice); // Added Math.min for safety
                    
                    if (unitsToSell > 0) { // Only proceed if there are units to sell
                        const repaidAmount = unitsToSell * sellPrice;
                        simState.holdings[symbol].units -= unitsToSell;
                        simState.debt -= repaidAmount; // Reduce global debt by actual repaid amount
                        simState.debtBySymbol[symbol] -= repaidAmount; // Reduce symbol-specific debt by actual repaid amount
                        
                        // If debtBySymbol is now zero or negative (due to float math or if we oversold due to previous bugs - though units check should prevent over sell based on debt), explicitly set to 0
                         if(simState.debtBySymbol[symbol] <= 0) {
                             simState.debtBySymbol[symbol] = 0;
                             simState.lastBuyDip[symbol] = 0; // Reset dip tracker for this symbol ONLY if debt is fully covered
                             simState.isTakeProfitArmed[symbol] = false; // Reset sell signal state ONLY if debt is fully covered
                         }
                         // Set the flag if any sell occurred
                         soldToday = true; // <--- SET FLAG TO TRUE
                    }
                }
            }


            // --- BUY LOGIC (SCALING-IN) ---
            // Only consider buying if no sell occurred for this symbol today
            if (!soldToday) { // <--- ADDED CONDITION
                const sortedDips = Object.keys(strategy.buyThresholds).map(parseFloat).sort((a, b) => a - b);
                for (const dipPct of sortedDips) {
                    const buyThreshold = strategy.buyThresholds[dipPct];
                    // Check if we can buy at a DEEPER level
                    if (buyThreshold > simState.lastBuyDip[symbol]) {
                        const thresholdPrice = runningHighForDecision * (1 - buyThreshold);
                        if (todayData.low <= thresholdPrice) {
                            
                            // Recalculate portfolio value for accurate leverage calculation
                            // This calculation should represent value *before* this specific potential buy transaction
                            let valueBeforeThisTrade = 0;
                             for (const s of symbols) {
                                if(dataMaps[s].has(todayTs)) { // Ensure data exists for today
                                     valueBeforeThisTrade += simState.holdings[s].units * dataMaps[s].get(todayTs).price;
                                }
                             }
                            const equityForThisTrade = valueBeforeThisTrade - simState.debt; // Use global debt

                            if (equityForThisTrade > 0) {
                                const targetLeverage = strategy.targetLeverages[dipPct];
                                const targetTotalValue = targetLeverage * equityForThisTrade;
                                // Amount to invest is the difference between the *target* total value at this leverage level
                                // and the current total value *before* this buy step.
                                const amountToInvest = targetTotalValue - valueBeforeThisTrade;
                                
                                if (amountToInvest > 0) {
                                    const newLoan = amountToInvest;
                                    // Calculate shares to buy based on the threshold price where the dip occurred
                                    const sharesToBuy = newLoan / thresholdPrice; 
                                    
                                    simState.debt += newLoan;
                                    simState.debtBySymbol[symbol] += newLoan;
                                    simState.holdings[symbol].units += sharesToBuy;
                                    simState.lastBuyDip[symbol] = buyThreshold; // Update the last buy dip level for this symbol
                                    
                                    // IMPORTANT: Since a buy occurred at this dip level, we should stop checking deeper dips *in this same day*
                                    // This is implied by the 'if (buyThreshold > simState.lastBuyDip[symbol])' check and the update of lastBuyDip *inside* the loop.
                                    // The loop will continue, but the condition 'buyThreshold > simState.lastBuyDip[symbol]' for *deeper* dips will fail now
                                    // unless the price dropped below MULTIPLE thresholds in a single day and the loop processed them sequentially.
                                    // The current logic handles buying at the *deepest* dip reached in the day among those deeper than lastBuyDip.
                                    // No need to break the loop explicitly here because the condition `buyThreshold > simState.lastBuyDip[symbol]` handles it for deeper dips.
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // ==================================================================
        // PART 2: CALCULATE END-OF-DAY STATE & UPDATE KNOWLEDGE
        // ==================================================================
        let finalHoldingsValue = 0;
        for (const symbol of symbols) {
            const todayData = dataMaps[symbol].get(todayTs);
            if (!todayData) continue;
            finalHoldingsValue += simState.holdings[symbol].units * todayData.price;
        }

        // --- MODIFIED BLOCK: Interest Calculation and Allocation ---
        if (simState.debt > 0) {
            const dailyInterestRate = (interestMap.get(todayTs) || 0) / 365;
            const totalInterestCost = simState.debt * dailyInterestRate;
            simState.debt += totalInterestCost; // Update global debt first

            // Now, proportionally allocate the interest cost to each symbol's debt
            const totalDebtBeforeInterest = Object.values(simState.debtBySymbol).reduce((sum, current) => sum + current, 0);

            if (totalDebtBeforeInterest > 0) {
                for (const symbol in simState.debtBySymbol) {
                    if (simState.debtBySymbol[symbol] > 0) {
                        const proportionOfDebt = simState.debtBySymbol[symbol] / totalDebtBeforeInterest;
                        const interestForSymbol = totalInterestCost * proportionOfDebt;
                        simState.debtBySymbol[symbol] += interestForSymbol;
                    }
                }
            }
        }
        // --- END OF MODIFIED BLOCK ---
        
        const finalEquity = finalHoldingsValue - simState.debt;

        // Margin Call Logic (using Debt/Equity ratio)
        // Check only if equity is positive, otherwise debt/equity is infinite or undefined.
        // If equity is zero or negative, margin call effectively happens or portfolio is already wiped.
        if (finalEquity > 0 && (simState.debt / finalEquity) > marginCallDebtToEquityRatio) {
             // Margin call occurs. Liquidate positions to repay debt.
             // Simplified: Assume full liquidation on margin call.
             marginCalled = true;
             marginCallCount++;
             simState.equity = 0; // Equity wiped out
             simState.debt = 0; // Debt is assumed cleared by liquidation
             for(const symbol in simState.holdings) {
                 simState.holdings[symbol].units = 0; // Holdings wiped out
                 simState.debtBySymbol[symbol] = 0; // Symbol debt wiped out
                 simState.lastBuyDip[symbol] = 0; // Reset state
                 simState.isTakeProfitArmed[symbol] = false; // Reset state
             }

        } else {
            simState.equity = finalEquity;
        }

        let currentBHValue = 0;
        for (const symbol of symbols) {
            const todayData = dataMaps[symbol].get(todayTs);
            if (!todayData) continue;
            currentBHValue += buyAndHoldState.holdings[symbol].units * todayData.price;
        }
        buyAndHoldState.totalValue = currentBHValue;

        const dailyRecord = {
            date,
            equity: simState.equity,
            debt: simState.debt,
            totalValue: finalHoldingsValue,
            bhValue: buyAndHoldState.totalValue,
            marginCalled: marginCalled, // Record margin call status for this day
            composition: {}
        };
         if (!marginCalled) { // Only record composition if not wiped out
            for (const symbol of symbols) {
                const todayData = dataMaps[symbol].get(todayTs);
                if (!todayData) continue;
                dailyRecord.composition[symbol] = simState.holdings[symbol].units * todayData.price;
            }
         } else { // If margin called, composition is all zero
             for (const symbol of symbols) {
                 dailyRecord.composition[symbol] = 0;
             }
         }
        history.push(dailyRecord);

        // Update running highs for the next day's decisions
        // Only update if margin call did NOT happen (as prices/state are reset)
        if (!marginCalled) {
            for (const symbol of symbols) {
                const todayData = dataMaps[symbol].get(todayTs);
                if (!todayData) continue;
                simState.runningHighs[symbol] = Math.max(simState.runningHighs[symbol], todayData.high);
            }
        }
    }
    return {
        range,
        history,
        summary: {
            marginCalled,
            marginCallCount
        }
    };
}

/**
 * Calculates the relative weight of each recommendation based on its profit.
 */
export function calculateRelativeWeights(recommendationList) {
    const positiveNetProfits = recommendationList.map(r => r.avg_net_profit_after_interest).filter(p => p > 0);
    const totalProfitSum = positiveNetProfits.reduce((sum, current) => sum + current, 0);

    return recommendationList.map(result => {
        const profit = result.avg_net_profit_after_interest;
        return {
            dip_pct: result.dip_pct,
            relative_weight_pct: totalProfitSum > 0 && profit > 0 ?
                (profit / totalProfitSum) * 100 : 0,
            avg_net_profit: profit,
            avg_closed_trades: result.avg_closed_trades,
            avg_duration: result.avg_closed_trades > 0 ? result.avg_total_days / result.avg_closed_trades : 0
        };
    }).sort((a, b) => a.dip_pct - b.dip_pct);
}

/**
 * Calculates the optimal leverage plan based on a given strategy and risk constraints.
 */
export function calculateOptimalLeveragePlan(params) {
    const { initialCapital, strategy, safetyDipRatio, safetyLeverageRatio } = params;
    const targetDebtEquityRatio = safetyLeverageRatio - 1;
    let depreciationFactorSum = 0;

    const validStrategySteps = strategy.filter(step => step.relative_weight_pct > 0);

    for (let i = 0; i < validStrategySteps.length; i++) {
        const step = validStrategySteps[i];
        const wi = step.relative_weight_pct / 100;
        const pi = step.dip_pct / 100;
        depreciationFactorSum += wi * ((1 - safetyDipRatio) / (1 - pi));
    }

    const numerator = targetDebtEquityRatio * initialCapital * (1 - safetyDipRatio);
    const denominator = 1 - targetDebtEquityRatio * (depreciationFactorSum - 1);

    if (denominator <= 0) {
        throw new Error("Cannot calculate a stable plan with the given risk limits. Try increasing the worst-case dip or decreasing the max leverage.");
    }
    const totalLoan = numerator / denominator;
    let paperAssets = initialCapital,
        paperDebt = 0,
        previousDip = 0;

    const finalPlan = validStrategySteps.map(step => {
        const loanForStep = totalLoan * (step.relative_weight_pct / 100);
        const targetCumulativeDebt = paperDebt + loanForStep;
        const depreciationFactor = (1 - step.dip_pct / 100) / (1 - previousDip / 100);
        paperAssets *= depreciationFactor;
        const equityAtTrigger = paperAssets - paperDebt;
        const targetAssets = equityAtTrigger + targetCumulativeDebt;
        const leverageRatio = (equityAtTrigger > 0) ? targetAssets / equityAtTrigger : 1;
        paperAssets = targetAssets;
        paperDebt = targetCumulativeDebt;
        previousDip = step.dip_pct;
        return {
            dip_pct: step.dip_pct,
            leverage_pct: leverageRatio * 100,
            loan_amount: loanForStep,
            loan_pct: step.relative_weight_pct
        };
    });

    const finalLeverageAtLastBuy = finalPlan.length > 0 ? finalPlan[finalPlan.length - 1].leverage_pct : 100;

    return {
        plan: finalPlan,
        totalLoan: totalLoan,
        finalLeverageAtLastBuy: finalLeverageAtLastBuy
    };
}

/**
 * Generates a concrete action plan based on the current portfolio state and market prices.
 */
export function generateActionPlan(params) {
    const { userHoldings, currentDebt, currentPrices, portfolio, historicalData } = params;

    // 1. Calculate Current Financial State
    let totalAssets = 0;
    for (const symbol in userHoldings) {
        if(currentPrices[symbol]) {
            totalAssets += userHoldings[symbol] * currentPrices[symbol];
        }
    }
    const currentEquity = totalAssets - currentDebt;
    if (currentEquity <= 0) throw new Error("Equity is zero or negative. Cannot calculate an action plan.");
    const currentLeverage = totalAssets / currentEquity;

    // 2. Determine Target Leverage from Strategy
    let targetLeverage = 1.0;
    let triggeringSymbol = 'N/A';
    let triggeringDip = 0;

    for (const symbol of Object.keys(portfolio)) {
        const normalizedData = historicalData[symbol].map(d => ({...d, date: new Date(d.date) }));
        const runningHigh = normalizedData.reduce((max, d) => Math.max(max, d.high), 0);
        if (runningHigh === 0) continue;

        const currentPrice = currentPrices[symbol];
        if(!currentPrice) continue;
        const currentDipRatio = 1 - (currentPrice / runningHigh);

        const strategy = portfolio[symbol].strategy;
        if (!strategy) continue;

        const sortedDips = Object.keys(strategy.buyThresholds).map(parseFloat).sort((a, b) => a - b);
        const achievedDips = sortedDips.filter(dipPct => currentDipRatio >= (dipPct / 100.0));

        if (achievedDips.length > 0) {
            const highestAchievedDip = Math.max(...achievedDips);
            const potentialTargetLeverage = strategy.targetLeverages[highestAchievedDip];
            if (potentialTargetLeverage > targetLeverage) {
                targetLeverage = potentialTargetLeverage;
                triggeringSymbol = symbol;
                triggeringDip = highestAchievedDip;
            }
        }
    }

    // 3. Generate Recommendation
    const targetTotalValue = targetLeverage * currentEquity;
    const amountToInvestOrDivest = targetTotalValue - totalAssets;
    
    return {
        currentEquity,
        currentLeverage,
        targetLeverage,
        triggeringSymbol,
        triggeringDip,
        amountToInvestOrDivest,
        priceOfTriggeringSymbol: currentPrices[triggeringSymbol] || 0
    };
}