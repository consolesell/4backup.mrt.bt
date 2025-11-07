// decisions.js

/* ---------- Adaptive Duration Optimization ---------- */
function optimizeTradeDuration(decision, regime, volatility, pattern) {
    const baseGranularity = parseInt(granEl.value, 10);
    
    // Risk-adjusted duration based on multiple factors
    let durationMultiplier = 1.0;
    let riskScore = 0.5;
    
    // Regime-based adjustment
    switch (regime.type) {
        case 'STRONG_UPTREND':
        case 'STRONG_DOWNTREND':
            durationMultiplier = 1.5; // Hold longer in strong trends
            riskScore = 0.3;
            break;
        case 'HIGH_VOLATILITY':
            durationMultiplier = 0.7; // Shorter duration in high vol
            riskScore = 0.7;
            break;
        case 'CONSOLIDATION':
            durationMultiplier = 0.8; // Moderate duration in ranging
            riskScore = 0.6;
            break;
    }
    
    // Pattern-based adjustment
    if (pattern.strength > 0.8) {
        durationMultiplier *= 1.2; // Strong patterns justify longer holds
        riskScore *= 0.85;
    }
    
    // Volatility-based adjustment
    if (volatility > 0.015) {
        durationMultiplier *= 0.8; // Reduce duration in extreme volatility
        riskScore *= 1.2;
    } else if (volatility < 0.005) {
        durationMultiplier *= 1.1; // Can hold longer in low volatility
        riskScore *= 0.9;
    }
    
    // Confidence-based adjustment
    if (decision.confidence > 0.8) {
        durationMultiplier *= 1.15;
        riskScore *= 0.9;
    } else if (decision.confidence < 0.6) {
        durationMultiplier *= 0.85;
        riskScore *= 1.1;
    }
    
    const optimizedDuration = Math.round(baseGranularity * durationMultiplier);
    const finalDuration = Math.max(baseGranularity, Math.min(optimizedDuration, baseGranularity * 3));
    
    return {
        duration: finalDuration,
        riskScore: Math.min(riskScore, 1),
        rationale: `Optimized from ${baseGranularity}s to ${finalDuration}s (${regime.type}, Vol: ${(volatility * 100).toFixed(3)}%)`
    };
}

/* ---------- Enhanced Decision Engine ---------- */
function advancedDecisionEngine(candles) {
    if (!candles || candles.length < 50) return { action: 'HOLD', reason: 'Insufficient data', confidence: 0 };
    
    const closes = candles.map(c => c.close);
    const ma14 = calcMA(closes, 14);
    const ma50 = calcMA(closes, 50);
    const rsi = calcRSI(closes, 14);
    const bb = calcBollinger(closes, 20, 2);
    const macd = calcMACD(closes);
    const volatility = calcVolatility(closes, 20);
    const atr = calcATR(candles, 14);
    
    // Update market regime
    marketRegime = detectMarketRegime(candles);
    
    // Get recent performance
    const hist = JSON.parse(localStorage.getItem('tradeHistory') || '[]');
    const recentTrades = hist.slice(0, 20);
    const winRate = recentTrades.length > 0 ? 
        recentTrades.filter(t => t.result === 'WIN').length / recentTrades.length : 0.5;
    
    // Update indicator weights
    updateIndicatorWeights(marketRegime, { winRate });
    
    // Identify candlestick pattern
    const pattern = identifyCandlestickPattern(candles);
    
    // Micro-structure analysis
    const microAnalysis = analyzeMicroStructure(tickBuffer, candles[candles.length - 1]);
    
    const i = closes.length - 1;
    const price = closes[i];
    const prevPrice = closes[i - 1];
    const ma14Now = ma14[i];
    const ma50Now = ma50[i];
    const rsiNow = rsi[i] || 50;
    const bbNow = bb[i];
    const macdNow = macd.histogram[i];
    const atrNow = atr[i];
    
    if (ma14Now === null || rsiNow === null || !bbNow.upper) {
        return { action: 'HOLD', reason: 'Indicators not ready', confidence: 0 };
    }
    
    // Calculate weighted signals
    const trendSignal = (price > ma14Now ? 1 : -1) * indicatorWeights.ma;
    const momentumSignal = ((price - prevPrice) / prevPrice * 1000) * indicatorWeights.momentum;
    const rsiSignal = (rsiNow < 30 ? 1 : (rsiNow > 70 ? -1 : 0)) * indicatorWeights.rsi;
    const bbSignal = (price <= bbNow.lower ? 1 : (price >= bbNow.upper ? -1 : 0)) * indicatorWeights.bb;
    const macdSignal = (macdNow > 0 ? 1 : -1) * 0.8;
    
    // Pattern signal
    let patternSignal = 0;
    if (pattern.signal === 'BULLISH' || pattern.signal === 'STRONG_BULLISH') patternSignal = pattern.strength;
    if (pattern.signal === 'BEARISH' || pattern.signal === 'STRONG_BEARISH') patternSignal = -pattern.strength;
    
    // Micro-structure signal
    let microSignal = 0;
    if (microAnalysis.prediction === 'BULLISH_CONTINUATION') microSignal = 0.6;
    if (microAnalysis.prediction === 'BEARISH_CONTINUATION') microSignal = -0.6;
    
    // Composite signal
    const compositeSignal = trendSignal + momentumSignal + rsiSignal + bbSignal + 
                           macdSignal + patternSignal + microSignal;
    
    // Confidence calculation
    const signalStrength = Math.abs(compositeSignal);
    let baseConfidence = Math.min(signalStrength / 5, 1);
    
    // Adjust confidence based on regime
    baseConfidence *= marketRegime.confidence;
    
    // Adjust for pattern strength
    if (pattern.strength > 0.7) baseConfidence *= 1.15;
    
    // Adjust for recent performance
    if (winRate > 0.6) baseConfidence *= 1.1;
    else if (winRate < 0.4) baseConfidence *= 0.85;
    
    const confidence = Math.min(baseConfidence, 0.95);
    
    // Volatility filter
    if (volatility < 0.002) {
        return { 
            action: 'HOLD', 
            reason: 'Extremely low volatility - no edge', 
            confidence: 0,
            indicators: { ma14Now, ma50Now, rsiNow, bbNow, volatility, atr: atrNow, pattern, microAnalysis }
        };
    }
    
    // Decision logic with enhanced thresholds
    let action = 'HOLD';
    let reason = 'No clear signal';
    
    if (compositeSignal > 2.5 && confidence > 0.65) {
        action = compositeSignal > 4 ? 'STRONG BUY' : 'BUY';
        reason = `Bullish composite signal (${compositeSignal.toFixed(2)}) | ${marketRegime.type} | ${pattern.pattern}`;
    } else if (compositeSignal < -2.5 && confidence > 0.65) {
        action = compositeSignal < -4 ? 'STRONG SELL' : 'SELL';
        reason = `Bearish composite signal (${compositeSignal.toFixed(2)}) | ${marketRegime.type} | ${pattern.pattern}`;
    } else if (Math.abs(compositeSignal) > 1.5 && confidence > 0.7) {
        action = compositeSignal > 0 ? 'BUY' : 'SELL';
        reason = `Moderate ${compositeSignal > 0 ? 'bullish' : 'bearish'} signal with high confidence`;
    } else {
        reason = `Insufficient signal strength (${compositeSignal.toFixed(2)}) or confidence (${(confidence * 100).toFixed(0)}%)`;
    }
    
    return {
        action,
        reason,
        confidence,
        compositeSignal,
        indicators: { 
            ma14Now, ma50Now, rsiNow, bbNow, volatility, 
            atr: atrNow, macd: macdNow, pattern, microAnalysis 
        },
        regime: marketRegime,
        weights: { ...indicatorWeights }
    };
}

/* ---------- Performance Tracking ---------- */
function updatePerformanceMetrics(record) {
    if (record.result === 'WIN') performanceMetrics.wins++;
    if (record.result === 'LOSS') performanceMetrics.losses++;
    if (record.profit !== undefined) performanceMetrics.totalProfit += record.profit;
    
    performanceMetrics.regimeHistory.push({
        time: record.time,
        regime: marketRegime.type,
        result: record.result
    });
    
    // Keep last 100 regime records
    if (performanceMetrics.regimeHistory.length > 100) {
        performanceMetrics.regimeHistory.shift();
    }
}

/* ---------- Simulation / Live Trade Flow ---------- */
function simulateTrade(params, indicators) {
    const { confidence, compositeSignal } = params.decisionObj || { confidence: 0.5, compositeSignal: 0 };
    const volFactor = indicators.volatility * 100;
    
    // Enhanced simulation with regime-aware probability
    let baseWinChance = 0.5;
    
    // Adjust based on signal strength
    baseWinChance += (confidence * 0.25);
    baseWinChance += (Math.abs(compositeSignal) / 10);
    
    // Regime adjustment
    if (marketRegime.type.includes('STRONG')) {
        baseWinChance += 0.1;
    } else if (marketRegime.type === 'HIGH_VOLATILITY') {
        baseWinChance -= 0.05; // Harder to predict
    }
    
    // Pattern adjustment
    if (indicators.pattern && indicators.pattern.strength > 0.75) {
        baseWinChance += 0.08;
    }
    
    // Cap probability
    baseWinChance = Math.max(0.3, Math.min(0.85, baseWinChance));
    
    const win = Math.random() < baseWinChance;
    const payoutFactor = win ? (1.75 + volFactor / 10) : -1;
    const profit = params.amount * payoutFactor;
    
    const rec = {
        time: new Date().toLocaleTimeString(),
        mode: 'SIMULATION',
        symbol: params.symbol,
        amount: params.amount,
        decision: params.decision,
        result: win ? 'WIN' : 'LOSS',
        profit,
        confidence: confidence,
        regime: marketRegime.type,
        duration: params.duration
    };
    
    saveHistoryRecord(rec);
    appendFeed(`Simulated ${rec.decision} on ${rec.symbol} → ${rec.result} (${profit.toFixed(2)}) [Conf: ${(confidence * 100).toFixed(0)}%]`, win ? 'success' : 'error');
    tradesMade++;
}

function requestLiveProposal(params) {
    const proposalReq = {
        proposal: 1,
        amount: params.amount,
        basis: 'stake',
        contract_type: params.contract_type,
        currency: 'USD',
        duration: params.duration,
        duration_unit: params.duration_unit,
        symbol: params.symbol,
        subscribe: 1
    };
    appendFeed(`Requesting live proposal (${params.contract_type}) for ${params.symbol} [Duration: ${params.duration}s]`, 'info');
    try {
        ws.send(JSON.stringify(proposalReq));
    } catch (e) {
        appendFeed(`Proposal request failed: ${e.message}`, 'error');
    }
}