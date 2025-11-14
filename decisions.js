/* ---------- Enhanced Configuration & State ---------- */
const decisionAgents = [
    { name: 'trend_focus', weights: { ma: 1.3, momentum: 0.7, rsi: 0.9, bb: 1.0 }, wins: 0, trades: 0 },
    { name: 'momentum_focus', weights: { ma: 0.7, momentum: 1.4, rsi: 1.1, bb: 0.8 }, wins: 0, trades: 0 },
    { name: 'balanced', weights: { ma: 1.0, momentum: 1.0, rsi: 1.0, bb: 1.0 }, wins: 0, trades: 0 },
    { name: 'volatility_rider', weights: { ma: 0.8, momentum: 1.2, rsi: 0.7, bb: 1.3 }, wins: 0, trades: 0 }
];

let activeAgent = decisionAgents[2]; // Start with balanced
let decisionMemory = [];

/* ---------- Market Mood Engine ---------- */
function marketMood(candles) {
    if (!candles || candles.length < 10) return 'NEUTRAL';
    
    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume || 1);
    const recentCandles = candles.slice(-20);
    
    // Calculate directional momentum
    const upMoves = closes.filter((v, i) => i > 0 && v > closes[i - 1]).length;
    const downMoves = closes.filter((v, i) => i > 0 && v < closes[i - 1]).length;
    const moodRatio = upMoves / (upMoves + downMoves || 1);
    
    // Volume-weighted sentiment
    let volumeWeightedSentiment = 0;
    recentCandles.forEach((candle, i) => {
        if (i > 0) {
            const direction = candle.close > candle.open ? 1 : -1;
            const volumeWeight = volumes[volumes.length - 20 + i] || 1;
            volumeWeightedSentiment += direction * volumeWeight;
        }
    });
    
    const normalizedSentiment = volumeWeightedSentiment / recentCandles.length;
    
    // Combine ratio and sentiment
    const compositeMood = (moodRatio * 0.6) + ((normalizedSentiment + 1) / 2 * 0.4);
    
    let mood = 'NEUTRAL';
    let strength = 0;
    
    if (compositeMood > 0.62) {
        mood = 'BULLISH';
        strength = (compositeMood - 0.62) / 0.38;
    } else if (compositeMood < 0.38) {
        mood = 'BEARISH';
        strength = (0.38 - compositeMood) / 0.38;
    } else {
        mood = 'NEUTRAL';
        strength = 1 - Math.abs(compositeMood - 0.5) * 2;
    }
    
    return { mood, strength: Math.min(strength, 1), ratio: compositeMood };
}

/* ---------- Temporal Intelligence ---------- */
function getTemporalContext() {
    const now = new Date();
    const hour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay();
    const minute = now.getUTCMinutes();
    
    let liquidityScore = 1.0;
    let volatilityExpectation = 1.0;
    let confidenceModifier = 1.0;
    
    // Low liquidity hours (00:00 - 03:00 UTC)
    if (hour >= 0 && hour < 3) {
        liquidityScore = 0.6;
        confidenceModifier = 0.85;
    }
    
    // Asian session (23:00 - 08:00 UTC)
    if (hour >= 23 || hour < 8) {
        volatilityExpectation = 0.8;
    }
    
    // London open (08:00 - 09:00 UTC)
    if (hour === 8) {
        volatilityExpectation = 1.4;
    }
    
    // US session (13:00 - 21:00 UTC)
    if (hour >= 13 && hour <= 21) {
        liquidityScore = 1.2;
        volatilityExpectation = 1.3;
    }
    
    // Weekend (reduced confidence)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        liquidityScore *= 0.7;
        confidenceModifier *= 0.9;
    }
    
    // Hour transitions (higher uncertainty)
    if (minute < 5 || minute > 55) {
        confidenceModifier *= 0.95;
    }
    
    return {
        hour,
        dayOfWeek,
        liquidityScore,
        volatilityExpectation,
        confidenceModifier,
        session: hour >= 13 && hour <= 21 ? 'US' : 
                 (hour >= 8 && hour < 13 ? 'LONDON' : 'ASIAN')
    };
}

/* ---------- Decision Agent Selection ---------- */
function selectBestAgent(history) {
    if (!history || history.length < 20) return activeAgent;
    
    const recentTrades = history.slice(-100);
    
    // Update agent statistics
    decisionAgents.forEach(agent => {
        const agentTrades = recentTrades.filter(t => t.agent === agent.name);
        agent.trades = agentTrades.length;
        agent.wins = agentTrades.filter(t => t.result === 'WIN').length;
        agent.winRate = agent.trades > 0 ? agent.wins / agent.trades : 0.5;
    });
    
    // Find best performing agent
    const sortedAgents = [...decisionAgents].sort((a, b) => {
        const aScore = (a.winRate * 0.7) + (a.trades > 10 ? 0.3 : 0);
        const bScore = (b.winRate * 0.7) + (b.trades > 10 ? 0.3 : 0);
        return bScore - aScore;
    });
    
    // Occasionally explore other agents (10% chance)
    if (Math.random() < 0.1) {
        return decisionAgents[Math.floor(Math.random() * decisionAgents.length)];
    }
    
    return sortedAgents[0];
}

/* ---------- Adaptive Weight Refinement ---------- */
function refineWeights(tradeHistory, currentRegime) {
    if (!tradeHistory || tradeHistory.length < 50) return;
    
    const recentTrades = tradeHistory.slice(-200);
    const winRate = recentTrades.filter(t => t.result === 'WIN').length / (recentTrades.length || 1);
    
    // Adjust weights based on performance
    if (winRate < 0.45) {
        indicatorWeights.momentum *= 1.08;
        indicatorWeights.ma *= 0.95;
        indicatorWeights.rsi *= 1.05;
    } else if (winRate > 0.60) {
        indicatorWeights.rsi *= 0.92;
        indicatorWeights.bb *= 1.05;
        indicatorWeights.momentum *= 0.97;
    }
    
    // Regime-specific adjustments
    if (currentRegime.type === 'HIGH_VOLATILITY') {
        indicatorWeights.bb *= 1.1;
        indicatorWeights.momentum *= 0.9;
    } else if (currentRegime.type.includes('STRONG')) {
        indicatorWeights.ma *= 1.15;
        indicatorWeights.momentum *= 1.1;
    }
    
    // Normalize weights to prevent drift
    const totalWeight = Object.values(indicatorWeights).reduce((a, b) => a + b, 0);
    const normFactor = 4.0 / totalWeight; // Target sum of 4.0
    
    Object.keys(indicatorWeights).forEach(key => {
        indicatorWeights[key] *= normFactor;
        indicatorWeights[key] = Math.max(0.3, Math.min(2.0, indicatorWeights[key]));
    });
}

/* ---------- Multi-Stage Decision Confirmation ---------- */
function confirmDecision(decision, indicators, recentResults, confidence, temporal) {
    let adjustedDecision = decision;
    let adjustedConfidence = confidence;
    const adjustments = [];
    
    // Check recent losing streak
    const lastTrades = recentResults.slice(-5);
    const consecutiveLosses = lastTrades.reduce((count, trade) => {
        return trade.result === 'LOSS' ? count + 1 : 0;
    }, 0);
    
    if (consecutiveLosses >= 4) {
        adjustedConfidence *= 0.8;
        adjustments.push('Loss streak penalty');
        
        // Pause aggressive trades
        if ((decision === 'STRONG BUY' || decision === 'STRONG SELL') && indicators.volatility > 0.015) {
            adjustedDecision = decision.includes('BUY') ? 'BUY' : 'SELL';
            adjustments.push('Downgraded from STRONG to regular');
        }
    }
    
    // Check for repeated same-direction losses
    const lastSameDirection = lastTrades.filter(t => t.decision === decision);
    const sameDirLosses = lastSameDirection.filter(t => t.result === 'LOSS').length;
    
    if (sameDirLosses >= 2 && lastSameDirection.length >= 3) {
        adjustedConfidence *= 0.85;
        adjustments.push('Same-direction loss penalty');
    }
    
    // Volatility safety check
    if (indicators.volatility > 0.025 && consecutiveLosses >= 3) {
        adjustedDecision = 'HOLD';
        adjustedConfidence = 0;
        adjustments.push('High volatility + losses → HOLD');
    }
    
    // Temporal risk adjustment
    if (temporal.liquidityScore < 0.7 && (decision === 'STRONG BUY' || decision === 'STRONG SELL')) {
        adjustedDecision = decision.includes('BUY') ? 'BUY' : 'SELL';
        adjustedConfidence *= 0.9;
        adjustments.push('Low liquidity downgrade');
    }
    
    // Pattern contradiction check
    if (indicators.pattern) {
        const patternSignal = indicators.pattern.signal;
        const decisionDirection = decision.includes('BUY') ? 'BULLISH' : 
                                 decision.includes('SELL') ? 'BEARISH' : 'NEUTRAL';
        
        if (patternSignal.includes('BULLISH') && decisionDirection === 'BEARISH') {
            adjustedConfidence *= 0.85;
            adjustments.push('Pattern-decision conflict');
        } else if (patternSignal.includes('BEARISH') && decisionDirection === 'BULLISH') {
            adjustedConfidence *= 0.85;
            adjustments.push('Pattern-decision conflict');
        }
    }

    // Trend-alignment veto
    if (indicators.trend === 'UPTREND' && indicators.strength > 0.7 && adjustedDecision.includes('SELL')) {
        adjustedDecision = 'HOLD';
        adjustedConfidence = 0;
        adjustments.push('Vetoed SELL against strong uptrend');
    } else if (indicators.trend === 'DOWNTREND' && indicators.strength > 0.7 && adjustedDecision.includes('BUY')) {
        adjustedDecision = 'HOLD';
        adjustedConfidence = 0;
        adjustments.push('Vetoed BUY against strong downtrend');
    }
    
    // Confidence floor check
    if (adjustedConfidence < 0.45 && adjustedDecision !== 'HOLD') {
        adjustedDecision = 'HOLD';
        adjustments.push('Confidence below threshold');
    }
    
    return {
        decision: adjustedDecision,
        confidence: Math.max(0, Math.min(1, adjustedConfidence)),
        adjustments: adjustments.length > 0 ? adjustments : ['No adjustments']
    };
}

/* ---------- Layered Pre-Decision Analysis ---------- */
function preDecisionLayerAnalysis(candles, indicators) {
    const environment = {
        trend: 'UNDEFINED',
        strength: 0,
        clarity: 0,
        noise: 0
    };
    
    // Trend classification
    const ma14 = indicators.ma14Now;
    const ma50 = indicators.ma50Now;
    const price = candles[candles.length - 1].close;
    
    if (ma14 > ma50 * 1.002) {
        environment.trend = 'UPTREND';
        environment.strength = Math.min((ma14 / ma50 - 1) * 100, 1);
    } else if (ma14 < ma50 * 0.998) {
        environment.trend = 'DOWNTREND';
        environment.strength = Math.min((1 - ma14 / ma50) * 100, 1);
    } else {
        environment.trend = 'SIDEWAYS';
        environment.strength = 0.3;
    }
    
    // Signal clarity (how aligned are indicators)
    const signals = [];
    if (price > ma14) signals.push(1);
    else signals.push(-1);
    
    if (indicators.rsiNow < 40) signals.push(1);
    else if (indicators.rsiNow > 60) signals.push(-1);
    else signals.push(0);
    
    if (price <= indicators.bbNow.lower) signals.push(1);
    else if (price >= indicators.bbNow.upper) signals.push(-1);
    else signals.push(0);
    
    const avgSignal = signals.reduce((a, b) => a + b, 0) / signals.length;
    environment.clarity = Math.abs(avgSignal);
    
    // Noise level (volatility vs movement efficiency)
    environment.noise = indicators.volatility > 0.015 ? 0.8 : 
                       indicators.volatility > 0.01 ? 0.5 : 0.2;
    
    return environment;
}

/* ---------- Decision Rationale Matrix ---------- */
function buildDecisionRationale(signals, weights, mood, temporal, environment) {
    return {
        signals: {
            trend: { value: signals.trend, weight: weights.ma, contribution: signals.trend * weights.ma },
            momentum: { value: signals.momentum, weight: weights.momentum, contribution: signals.momentum * weights.momentum },
            rsi: { value: signals.rsi, weight: weights.rsi, contribution: signals.rsi * weights.rsi },
            bb: { value: signals.bb, weight: weights.bb, contribution: signals.bb * weights.bb },
            macd: { value: signals.macd, weight: 0.8, contribution: signals.macd * 0.8 },
            pattern: { value: signals.pattern, weight: 1.0, contribution: signals.pattern },
            micro: { value: signals.micro, weight: 0.6, contribution: signals.micro * 0.6 }
        },
        context: {
            mood: mood.mood,
            moodStrength: mood.strength,
            temporalSession: temporal.session,
            liquidityScore: temporal.liquidityScore,
            environment: environment.trend
        },
        composite: {
            total: Object.values(signals).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0),
            normalized: 0 // Will be calculated
        }
    };
}

/* ---------- Adaptive Confidence Modeling ---------- */
function calculateAdaptiveConfidence(compositeSignal, indicators, regime, mood, temporal, recentPerformance) {
    // Base confidence from signal strength
    const signalStrength = Math.abs(compositeSignal);
    let confidence = Math.min(signalStrength / 5, 1) * 0.5; // Base 50% max from signal
    
    // Decision consistency bonus
    const decisionConsistency = signalStrength / 10;
    confidence += decisionConsistency * 0.15;
    
    // Regime confidence
    confidence *= regime.confidence;
    
    // Pattern strength bonus
    if (indicators.pattern && indicators.pattern.strength > 0.7) {
        confidence += 0.1 * indicators.pattern.strength;
    }
    
    // Mood alignment
    const moodBonus = mood.strength * 0.08;
    confidence += moodBonus;
    
    // Recent performance adjustment
    const winRate = recentPerformance.winRate || 0.5;
    if (winRate > 0.6) {
        confidence *= 1.1;
    } else if (winRate < 0.4) {
        confidence *= 0.85;
    }
    
    // Temporal adjustment
    confidence *= temporal.confidenceModifier;
    
    // Volatility penalty for extreme cases
    if (indicators.volatility > 0.018) {
        confidence *= 0.9;
    }
    
    // Environment clarity bonus
    const closes = indicators.closes || [];
    if (closes.length >= 20) {
        const recent = closes.slice(-20);
        const trend = recent[recent.length - 1] - recent[0];
        const avgChange = recent.reduce((sum, v, i) => i > 0 ? sum + Math.abs(v - recent[i-1]) : sum, 0) / 19;
        const efficiency = Math.abs(trend) / (avgChange * 20 || 1);
        
        if (efficiency > 0.6) {
            confidence *= 1.08; // Clean trending movement
        }
    }
    
    // Cap confidence
    return Math.max(0.25, Math.min(0.98, confidence*1.05));
}

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
    // Force minimum 15 minutes duration
    const finalDuration = Math.max(15, optimizedDuration / 60);
    
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
    
    const recentPerformance = { winRate, recentTrades };
    
    // Refine weights based on performance
    refineWeights(hist, marketRegime);
    
    // Select best performing agent
    activeAgent = selectBestAgent(hist);
    const agentWeights = {
        ma: indicatorWeights.ma * activeAgent.weights.ma,
        momentum: indicatorWeights.momentum * activeAgent.weights.momentum,
        rsi: indicatorWeights.rsi * activeAgent.weights.rsi,
        bb: indicatorWeights.bb * activeAgent.weights.bb
    };
    
    // Market mood analysis
    const mood = marketMood(candles);
    
    // Temporal context
    const temporal = getTemporalContext();
    
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
    
    // Pre-decision environment analysis
    const environment = preDecisionLayerAnalysis(candles, { ma14Now, ma50Now, rsiNow, bbNow, volatility });
    
    // Calculate weighted signals with agent modifiers
    const trendSignal = (price > ma14Now ? 1 : -1) * agentWeights.ma;
    const momentumSignal = ((price - prevPrice) / prevPrice * 1000) * agentWeights.momentum;
    const rsiSignal = (rsiNow < 30 ? 1 : (rsiNow > 70 ? -1 : 0)) * agentWeights.rsi;
    const bbSignal = (price <= bbNow.lower ? 1 : (price >= bbNow.upper ? -1 : 0)) * agentWeights.bb;
    const macdSignal = (macdNow > 0 ? 1 : -1) * 0.8;
    
    // Pattern signal
    let patternSignal = 0;
    if (pattern.signal === 'BULLISH' || pattern.signal === 'STRONG_BULLISH') patternSignal = pattern.strength;
    if (pattern.signal === 'BEARISH' || pattern.signal === 'STRONG_BEARISH') patternSignal = -pattern.strength;
    
    // Micro-structure signal
    let microSignal = 0;
    if (microAnalysis.prediction === 'BULLISH_CONTINUATION') microSignal = 0.6;
    if (microAnalysis.prediction === 'BEARISH_CONTINUATION') microSignal = -0.6;
    if (microAnalysis.prediction === 'REVERSAL_UP') microSignal = 0.7;
    if (microAnalysis.prediction === 'REVERSAL_DOWN') microSignal = -0.7;
    
    // Mood adjustment
    let moodSignal = 0;
    if (mood.mood === 'BULLISH') moodSignal = mood.strength * 0.5;
    if (mood.mood === 'BEARISH') moodSignal = -mood.strength * 0.5;
    
    // Composite signal
    const compositeSignal = trendSignal + momentumSignal + rsiSignal + bbSignal + 
                           macdSignal + patternSignal + microSignal + moodSignal;
    
    // Build decision rationale
    const rationale = buildDecisionRationale(
        { trend: trendSignal, momentum: momentumSignal, rsi: rsiSignal, 
          bb: bbSignal, macd: macdSignal, pattern: patternSignal, micro: microSignal },
        agentWeights, mood, temporal, environment
    );
    rationale.composite.normalized = compositeSignal;
    
    // Adaptive confidence calculation
    const baseConfidence = calculateAdaptiveConfidence(
        compositeSignal, 
        { pattern, volatility, closes, ma14Now, ma50Now, rsiNow, bbNow }, 
        marketRegime, 
        mood, 
        temporal, 
        recentPerformance
    );
    
    // Store last trade context
    const lastTrade = JSON.parse(localStorage.getItem('lastTrade') || '{}');
    
    // Volatility filter
    if (volatility < 0.002) {
        return { 
            action: 'HOLD', 
            reason: 'Extremely low volatility - no edge', 
            confidence: 0,
            indicators: { ma14Now, ma50Now, rsiNow, bbNow, volatility, atr: atrNow, pattern, microAnalysis },
            mood, temporal, environment, rationale, agent: activeAgent.name
        };
    }
    
    // Decision logic with enhanced thresholds
    let action = 'HOLD';
    let reason = 'No clear signal';
    
    // Apply environment and mood filters
    const environmentMultiplier = environment.clarity > 0.6 ? 1.1 : 0.95;
    const adjustedThreshold = 2.0 / environmentMultiplier;
    
    if (compositeSignal > adjustedThreshold && baseConfidence > 0.55) {
        action = compositeSignal > (4 / environmentMultiplier) ? 'STRONG BUY' : 'BUY';
        reason = `Bullish composite signal (${compositeSignal.toFixed(2)}) | ${marketRegime.type} | ${pattern.pattern} | ${mood.mood}`;
    } else if (compositeSignal < -adjustedThreshold && baseConfidence > 0.55) {
        action = compositeSignal < -(4 / environmentMultiplier) ? 'STRONG SELL' : 'SELL';
        reason = `Bearish composite signal (${compositeSignal.toFixed(2)}) | ${marketRegime.type} | ${pattern.pattern} | ${mood.mood}`;
    } else if (Math.abs(compositeSignal) > 1.5 && baseConfidence > 0.7 && environment.clarity > 0.5) {
        action = compositeSignal > 0 ? 'BUY' : 'SELL';
        reason = `Moderate ${compositeSignal > 0 ? 'bullish' : 'bearish'} signal with high confidence and clarity`;
    } else {
        reason = `Insufficient signal strength (${compositeSignal.toFixed(2)}) or confidence (${(baseConfidence * 100).toFixed(0)}%) | Clarity: ${environment.clarity.toFixed(2)}`;
    }
    
    // Multi-stage confirmation
    const confirmed = confirmDecision(action, { pattern, volatility, atr: atrNow, bbNow, trend: environment.trend, strength: environment.strength }, recentTrades, baseConfidence, temporal);
    
    // Check for mood-decision conflict
    if (mood.mood === 'BULLISH' && confirmed.decision.includes('SELL') && mood.strength > 0.6) {
        confirmed.confidence *= 0.88;
        confirmed.adjustments.push('Mood conflict: bullish mood vs sell signal');
    } else if (mood.mood === 'BEARISH' && confirmed.decision.includes('BUY') && mood.strength > 0.6) {
        confirmed.confidence *= 0.88;
        confirmed.adjustments.push('Mood conflict: bearish mood vs buy signal');
    }
    
    // Check for repeating same losing direction
    if (lastTrade.result === 'LOSS' && confirmed.decision === lastTrade.decision) {
        confirmed.confidence *= 0.82;
        confirmed.adjustments.push('Penalized: repeating last losing direction');
    }
    
    // Store decision in memory
    decisionMemory.push({
        time: new Date().toISOString(),
        decision: confirmed.decision,
        confidence: confirmed.confidence,
        compositeSignal,
        mood: mood.mood,
        regime: marketRegime.type
    });
    
    // Keep last 50 decisions
    if (decisionMemory.length > 50) decisionMemory.shift();
    
    return {
        action: confirmed.decision,
        reason: reason + (confirmed.adjustments.length > 1 ? ' | Adjustments: ' + confirmed.adjustments.join(', ') : ''),
        confidence: confirmed.confidence,
        compositeSignal,
        indicators: { 
            ma14Now, ma50Now, rsiNow, bbNow, volatility, 
            atr: atrNow, macd: macdNow, pattern, microAnalysis 
        },
        regime: marketRegime,
        mood,
        temporal,
        environment,
        rationale,
        agent: activeAgent.name,
        agentStats: { winRate: activeAgent.winRate, trades: activeAgent.trades },
        weights: { ...agentWeights },
        adjustments: confirmed.adjustments
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
        result: record.result,
        agent: record.agent || activeAgent.name
    });
    
    // Update agent statistics
    if (record.agent) {
        const agent = decisionAgents.find(a => a.name === record.agent);
        if (agent) {
            agent.trades++;
            if (record.result === 'WIN') agent.wins++;
        }
    }
    
    // Keep last 100 regime records
    if (performanceMetrics.regimeHistory.length > 100) {
        performanceMetrics.regimeHistory.shift();
    }
    
    // Store last trade for decision memory
    localStorage.setItem('lastTrade', JSON.stringify({
        decision: record.decision,
        result: record.result,
        confidence: record.confidence,
        regime: record.regime,
        time: record.time
    }));
    
    // Continuous micro-optimization
    const totalTrades = performanceMetrics.wins + performanceMetrics.losses;
    if (totalTrades > 0) {
        const currentWinRate = performanceMetrics.wins / totalTrades;
        
        // Auto-tune indicator weights based on performance
        if (totalTrades % 10 === 0) { // Every 10 trades
            if (currentWinRate < 0.45) {
                indicatorWeights.momentum = Math.min(indicatorWeights.momentum * 1.08, 1.5);
                indicatorWeights.rsi = Math.min(indicatorWeights.rsi * 1.05, 1.4);
                appendFeed(`⚙️ Auto-tuning: Increased momentum & RSI weights (WR: ${(currentWinRate * 100).toFixed(1)}%)`, 'info');
            } else if (currentWinRate > 0.65) {
                indicatorWeights.bb = Math.min(indicatorWeights.bb * 1.05, 1.4);
                indicatorWeights.momentum = Math.max(indicatorWeights.momentum * 0.95, 0.6);
                appendFeed(`⚙️ Auto-tuning: Adjusted BB & momentum (WR: ${(currentWinRate * 100).toFixed(1)}%)`, 'info');
            }
        }
    }
}

/* ---------- Historical Context Influence ---------- */
function analyzeHistoricalContext(recentTrades, currentDecision) {
    if (!recentTrades || recentTrades.length < 3) {
        return { contextScore: 1.0, insights: [] };
    }
    
    const insights = [];
    let contextScore = 1.0;
    
    // Analyze last 10 trades
    const last10 = recentTrades.slice(0, 10);
    
    // Check for decision fatigue (too many same-direction trades)
    const sameDirectionTrades = last10.filter(t => 
        (t.decision.includes('BUY') && currentDecision.includes('BUY')) ||
        (t.decision.includes('SELL') && currentDecision.includes('SELL'))
    );
    
    if (sameDirectionTrades.length >= 5) {
        const sameWinRate = sameDirectionTrades.filter(t => t.result === 'WIN').length / sameDirectionTrades.length;
        if (sameWinRate < 0.4) {
            contextScore *= 0.75;
            insights.push(`Direction fatigue: ${sameDirectionTrades.length} recent ${currentDecision.includes('BUY') ? 'BUY' : 'SELL'} trades with ${(sameWinRate * 100).toFixed(0)}% WR`);
        }
    }
    
    // Check for time-of-day patterns
    const currentHour = new Date().getUTCHours();
    const sameHourTrades = last10.filter(t => {
        const tradeHour = new Date(t.time).getUTCHours();
        return Math.abs(tradeHour - currentHour) <= 1;
    });
    
    if (sameHourTrades.length >= 3) {
        const hourWinRate = sameHourTrades.filter(t => t.result === 'WIN').length / sameHourTrades.length;
        if (hourWinRate > 0.7) {
            contextScore *= 1.1;
            insights.push(`Strong hour performance: ${(hourWinRate * 100).toFixed(0)}% WR at this time`);
        } else if (hourWinRate < 0.3) {
            contextScore *= 0.85;
            insights.push(`Weak hour performance: ${(hourWinRate * 100).toFixed(0)}% WR at this time`);
        }
    }
    
    // Check for regime consistency
    const currentRegime = marketRegime.type;
    const sameRegimeTrades = last10.filter(t => t.regime === currentRegime);
    
    if (sameRegimeTrades.length >= 4) {
        const regimeWinRate = sameRegimeTrades.filter(t => t.result === 'WIN').length / sameRegimeTrades.length;
        if (regimeWinRate > 0.65) {
            contextScore *= 1.08;
            insights.push(`Strong regime performance: ${(regimeWinRate * 100).toFixed(0)}% WR in ${currentRegime}`);
        } else if (regimeWinRate < 0.35) {
            contextScore *= 0.8;
            insights.push(`Weak regime performance: ${(regimeWinRate * 100).toFixed(0)}% WR in ${currentRegime}`);
        }
    }
    
    // Check for confidence accuracy
    const highConfTrades = last10.filter(t => t.confidence > 0.75);
    if (highConfTrades.length >= 3) {
        const highConfWinRate = highConfTrades.filter(t => t.result === 'WIN').length / highConfTrades.length;
        if (highConfWinRate < 0.5) {
            contextScore *= 0.85;
            insights.push(`High confidence underperforming: ${(highConfWinRate * 100).toFixed(0)}% WR on confident trades`);
        }
    }
    
    // Check for recent momentum
    const last5 = recentTrades.slice(0, 5);
    const recentWins = last5.filter(t => t.result === 'WIN').length;
    
    if (recentWins >= 4) {
        contextScore *= 1.05;
        insights.push(`Hot streak: ${recentWins}/5 recent wins`);
    } else if (recentWins <= 1) {
        contextScore *= 0.9;
        insights.push(`Cold streak: ${recentWins}/5 recent wins`);
    }
    
    return {
        contextScore: Math.max(0.5, Math.min(1.5, contextScore)),
        insights: insights.length > 0 ? insights : ['No significant historical patterns']
    };
}

/* ---------- Enhanced Risk Assessment ---------- */
function assessTradeRisk(decision, indicators, regime, mood, temporal, historicalContext) {
    let riskScore = 0.5; // Base risk (0 = lowest, 1 = highest)
    const riskFactors = [];
    
    // Volatility risk
    if (indicators.volatility > 0.02) {
        riskScore += 0.25;
        riskFactors.push('Extreme volatility');
    } else if (indicators.volatility > 0.015) {
        riskScore += 0.15;
        riskFactors.push('High volatility');
    } else if (indicators.volatility < 0.005) {
        riskScore += 0.1;
        riskFactors.push('Very low volatility (low profit potential)');
    }
    
    // Regime risk
    if (regime.type === 'HIGH_VOLATILITY') {
        riskScore += 0.2;
        riskFactors.push('High volatility regime');
    } else if (regime.type === 'CONSOLIDATION') {
        riskScore += 0.15;
        riskFactors.push('Ranging market (choppy)');
    } else if (regime.confidence < 0.6) {
        riskScore += 0.1;
        riskFactors.push('Uncertain regime');
    }
    
    // Mood-decision alignment risk
    if ((mood.mood === 'BULLISH' && decision.includes('SELL')) ||
        (mood.mood === 'BEARISH' && decision.includes('BUY'))) {
        if (mood.strength > 0.6) {
            riskScore += 0.15;
            riskFactors.push('Trading against market mood');
        }
    }
    
    // Temporal risk
    if (temporal.liquidityScore < 0.7) {
        riskScore += 0.1;
        riskFactors.push('Low liquidity period');
    }
    
    if (temporal.session === 'ASIAN' && indicators.volatility > 0.015) {
        riskScore += 0.05;
        riskFactors.push('High volatility during low-volume session');
    }
    
    // Pattern risk
    if (indicators.pattern && indicators.pattern.strength < 0.5) {
        riskScore += 0.08;
        riskFactors.push('Weak pattern formation');
    }
    
    // Historical context risk
    if (historicalContext.contextScore < 0.8) {
        riskScore += 0.12;
        riskFactors.push('Poor historical performance in similar conditions');
    }
    
    // ATR risk (relative to price)
    const atrPercent = (indicators.atr / indicators.price) * 100;
    if (atrPercent > 2) {
        riskScore += 0.1;
        riskFactors.push('High ATR relative to price');
    }
    
    // Decision strength risk
    if (decision.confidence < 0.65) {
        riskScore += 0.15;
        riskFactors.push('Low decision confidence');
    }
    
    // Cap risk score
    riskScore = Math.max(0.1, Math.min(1.0, riskScore));
    
    // Risk category
    let riskCategory = 'MODERATE';
    if (riskScore > 0.75) riskCategory = 'VERY HIGH';
    else if (riskScore > 0.6) riskCategory = 'HIGH';
    else if (riskScore < 0.35) riskCategory = 'LOW';
    else if (riskScore < 0.5) riskCategory = 'MODERATE-LOW';
    
    return {
        score: riskScore,
        category: riskCategory,
        factors: riskFactors.length > 0 ? riskFactors : ['Standard market conditions'],
        recommendation: riskScore > 0.7 ? 'Consider reducing position size or avoiding trade' :
                       riskScore > 0.55 ? 'Use conservative position sizing' :
                       'Risk acceptable for standard position'
    };
}

/* ---------- Decision Quality Score ---------- */
function calculateDecisionQuality(decision) {
    let qualityScore = 0;
    const qualityFactors = [];
    
    // Confidence quality
    if (decision.confidence > 0.75) {
        qualityScore += 30;
        qualityFactors.push('High confidence');
    } else if (decision.confidence > 0.65) {
        qualityScore += 20;
        qualityFactors.push('Good confidence');
    } else {
        qualityScore += 10;
        qualityFactors.push('Moderate confidence');
    }
    
    // Signal strength quality
    if (Math.abs(decision.compositeSignal) > 4) {
        qualityScore += 25;
        qualityFactors.push('Very strong signal');
    } else if (Math.abs(decision.compositeSignal) > 3) {
        qualityScore += 18;
        qualityFactors.push('Strong signal');
    } else {
        qualityScore += 10;
        qualityFactors.push('Moderate signal');
    }
    
    // Pattern quality
    if (decision.indicators.pattern && decision.indicators.pattern.strength > 0.75) {
        qualityScore += 15;
        qualityFactors.push('Strong pattern');
    } else if (decision.indicators.pattern && decision.indicators.pattern.strength > 0.5) {
        qualityScore += 8;
        qualityFactors.push('Moderate pattern');
    }
    
    // Regime clarity quality
    if (decision.regime.confidence > 0.8) {
        qualityScore += 15;
        qualityFactors.push('Clear regime');
    } else if (decision.regime.confidence > 0.65) {
        qualityScore += 8;
        qualityFactors.push('Defined regime');
    }
    
    // Environmental clarity
    if (decision.environment && decision.environment.clarity > 0.6) {
        qualityScore += 10;
        qualityFactors.push('Clear market structure');
    } else if (decision.environment && decision.environment.clarity > 0.4) {
        qualityScore += 5;
        qualityFactors.push('Moderate market clarity');
    }
    
    // Mood alignment
    if (decision.mood) {
        const moodAligned = (decision.mood.mood === 'BULLISH' && decision.action.includes('BUY')) ||
                           (decision.mood.mood === 'BEARISH' && decision.action.includes('SELL'));
        if (moodAligned && decision.mood.strength > 0.6) {
            qualityScore += 5;
            qualityFactors.push('Mood-aligned');
        }
    }
    
    // Adjustment penalty
    if (decision.adjustments && decision.adjustments.length > 2) {
        qualityScore -= 5;
        qualityFactors.push('Multiple adjustments needed');
    }
    
    qualityScore = Math.max(0, Math.min(100, qualityScore));
    
    let qualityGrade = 'C';
    if (qualityScore >= 85) qualityGrade = 'A+';
    else if (qualityScore >= 75) qualityGrade = 'A';
    else if (qualityScore >= 65) qualityGrade = 'B';
    else if (qualityScore >= 55) qualityGrade = 'C';
    else qualityGrade = 'D';
    
    return {
        score: qualityScore,
        grade: qualityGrade,
        factors: qualityFactors
    };
}

/* ---------- Simulation / Live Trade Flow ---------- */
function simulateTrade(params, indicators) {
    const { confidence, compositeSignal, regime, mood, temporal, environment } = params.decisionObj || { 
        confidence: 0.5, 
        compositeSignal: 0,
        regime: marketRegime,
        mood: { mood: 'NEUTRAL', strength: 0.5 },
        temporal: getTemporalContext(),
        environment: { clarity: 0.5 }
    };
    const volFactor = indicators.volatility * 100;
    
    // Get historical context
    const hist = JSON.parse(localStorage.getItem('tradeHistory') || '[]');
    const historicalContext = analyzeHistoricalContext(hist.slice(0, 20), params.decision);
    
    // Assess risk
    const riskAssessment = assessTradeRisk(
        { confidence, action: params.decision },
        { ...indicators, price: params.currentPrice || 1 },
        regime,
        mood,
        temporal,
        historicalContext
    );
    
    // Enhanced simulation with regime-aware probability
    let baseWinChance = 0.5;
    
    // Adjust based on signal strength
    baseWinChance += (confidence * 0.25);
    baseWinChance += (Math.abs(compositeSignal) / 10);
    
    // Regime adjustment
    if (regime.type.includes('STRONG')) {
        baseWinChance += 0.12;
    } else if (regime.type === 'HIGH_VOLATILITY') {
        baseWinChance -= 0.08; // Harder to predict
    } else if (regime.type === 'CONSOLIDATION') {
        baseWinChance -= 0.05; // Choppy
    }
    
    // Pattern adjustment
    if (indicators.pattern && indicators.pattern.strength > 0.75) {
        baseWinChance += 0.1;
    } else if (indicators.pattern && indicators.pattern.strength < 0.5) {
        baseWinChance -= 0.05;
    }
    
    // Mood alignment adjustment
    const moodAligned = (mood.mood === 'BULLISH' && params.decision.includes('BUY')) ||
                       (mood.mood === 'BEARISH' && params.decision.includes('SELL'));
    if (moodAligned && mood.strength > 0.6) {
        baseWinChance += 0.08;
    } else if (!moodAligned && mood.strength > 0.6) {
        baseWinChance -= 0.06;
    }
    
    // Temporal adjustment
    baseWinChance *= temporal.confidenceModifier;
    
    // Historical context adjustment
    baseWinChance *= historicalContext.contextScore;
    
    // Environment clarity adjustment
    if (environment && environment.clarity > 0.6) {
        baseWinChance += 0.06;
    } else if (environment && environment.clarity < 0.4) {
        baseWinChance -= 0.04;
    }
    
    // Risk adjustment
    if (riskAssessment.score > 0.7) {
        baseWinChance -= 0.1; // High risk reduces win probability
    }
    
    // Agent performance adjustment
    if (params.agent && activeAgent.winRate > 0) {
        const agentBonus = (activeAgent.winRate - 0.5) * 0.15;
        baseWinChance += agentBonus;
    }
    
    // Cap probability (realistic bounds)
    baseWinChance = Math.max(0.28, Math.min(0.83, baseWinChance));
    
    const win = Math.random() < baseWinChance;
    const payoutFactor = win ? (1.75 + volFactor / 10) : -1;
    const profit = params.amount * payoutFactor;
    
    const rec = {
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString(),
        mode: 'SIMULATION',
        symbol: params.symbol,
        amount: params.amount,
        decision: params.decision,
        result: win ? 'WIN' : 'LOSS',
        profit,
        confidence: confidence,
        compositeSignal: compositeSignal,
        regime: regime.type,
        mood: mood.mood,
        duration: params.duration,
        agent: params.agent || activeAgent.name,
        riskScore: riskAssessment.score,
        riskCategory: riskAssessment.category,
        quality: calculateDecisionQuality(params.decisionObj || {}).grade,
        winProbability: baseWinChance,
        temporalSession: temporal.session,
        environmentClarity: environment ? environment.clarity : 0.5
    };
    
    saveHistoryRecord(rec);
    
    // Enhanced feedback message
    const feedbackMsg = `${rec.result === 'WIN' ? '✅' : '❌'} Simulated ${rec.decision} on ${rec.symbol} → ${rec.result} ` +
                       `(${profit > 0 ? '+' : ''}${profit.toFixed(2)}) | ` +
                       `Conf: ${(confidence * 100).toFixed(0)}% | ` +
                       `Risk: ${riskAssessment.category} | ` +
                       `Quality: ${rec.quality} | ` +
                       `Agent: ${rec.agent}`;
    
    appendFeed(feedbackMsg, win ? 'success' : 'error');
    
    // Log insights if significant
    if (historicalContext.insights.length > 1 || riskAssessment.factors.length > 3) {
        const insightMsg = `📊 Context: ${historicalContext.insights[0] || 'Standard conditions'} | Risk: ${riskAssessment.factors[0]}`;
        appendFeed(insightMsg, 'info');
    }
    
    tradesMade++;
    
    // Update performance metrics with enhanced data
    updatePerformanceMetrics(rec);
}

function requestLiveProposal(params) {
    // Get historical context for live trade
    const hist = JSON.parse(localStorage.getItem('tradeHistory') || '[]');
    const historicalContext = analyzeHistoricalContext(hist.slice(0, 20), params.decision);
    
    // Assess risk before requesting proposal
    const indicators = params.decisionObj ? params.decisionObj.indicators : {};
    const riskAssessment = assessTradeRisk(
        params.decisionObj || { confidence: 0.5, action: params.decision },
        indicators,
        marketRegime,
        params.decisionObj ? params.decisionObj.mood : { mood: 'NEUTRAL', strength: 0.5 },
        getTemporalContext(),
        historicalContext
    );
    
    // Risk warning for very high risk trades
    if (riskAssessment.score > 0.75) {
        appendFeed(`⚠️ HIGH RISK ALERT: ${riskAssessment.category} - ${riskAssessment.recommendation}`, 'warning');
    }
    
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
    
    const qualityScore = params.decisionObj ? calculateDecisionQuality(params.decisionObj) : { grade: 'N/A', score: 0 };
    
    appendFeed(
        `📤 Requesting live proposal (${params.contract_type}) for ${params.symbol} | ` +
        `Duration: ${params.duration}s | Risk: ${riskAssessment.category} | Quality: ${qualityScore.grade}`,
        'info'
    );
    
    try {
        ws.send(JSON.stringify(proposalReq));
    } catch (e) {
        appendFeed(`Proposal request failed: ${e.message}`, 'error');
    }
}

/* ---------- Performance Analytics ---------- */
function getPerformanceAnalytics() {
    const hist = JSON.parse(localStorage.getItem('tradeHistory') || '[]');
    if (hist.length === 0) return null;
    
    const analytics = {
        overall: {
            totalTrades: hist.length,
            wins: hist.filter(t => t.result === 'WIN').length,
            losses: hist.filter(t => t.result === 'LOSS').length,
            winRate: 0,
            totalProfit: hist.reduce((sum, t) => sum + (t.profit || 0), 0),
            avgProfit: 0
        },
        byRegime: {},
        byAgent: {},
        byMood: {},
        byTimeSession: {},
        byRisk: {},
        recentTrend: null
    };
    
    analytics.overall.winRate = analytics.overall.wins / analytics.overall.totalTrades;
    analytics.overall.avgProfit = analytics.overall.totalProfit / analytics.overall.totalTrades;
    
    // Analyze by regime
    hist.forEach(trade => {
        if (trade.regime) {
            if (!analytics.byRegime[trade.regime]) {
                analytics.byRegime[trade.regime] = { trades: 0, wins: 0, profit: 0 };
            }
            analytics.byRegime[trade.regime].trades++;
            if (trade.result === 'WIN') analytics.byRegime[trade.regime].wins++;
            analytics.byRegime[trade.regime].profit += trade.profit || 0;
        }
        
        if (trade.agent) {
            if (!analytics.byAgent[trade.agent]) {
                analytics.byAgent[trade.agent] = { trades: 0, wins: 0, profit: 0 };
            }
            analytics.byAgent[trade.agent].trades++;
            if (trade.result === 'WIN') analytics.byAgent[trade.agent].wins++;
            analytics.byAgent[trade.agent].profit += trade.profit || 0;
        }
        
        if (trade.mood) {
            if (!analytics.byMood[trade.mood]) {
                analytics.byMood[trade.mood] = { trades: 0, wins: 0, profit: 0 };
            }
            analytics.byMood[trade.mood].trades++;
            if (trade.result === 'WIN') analytics.byMood[trade.mood].wins++;
            analytics.byMood[trade.mood].profit += trade.profit || 0;
        }
        
        if (trade.temporalSession) {
            if (!analytics.byTimeSession[trade.temporalSession]) {
                analytics.byTimeSession[trade.temporalSession] = { trades: 0, wins: 0, profit: 0 };
            }
            analytics.byTimeSession[trade.temporalSession].trades++;
            if (trade.result === 'WIN') analytics.byTimeSession[trade.temporalSession].wins++;
            analytics.byTimeSession[trade.temporalSession].profit += trade.profit || 0;
        }
        
        if (trade.riskCategory) {
            if (!analytics.byRisk[trade.riskCategory]) {
                analytics.byRisk[trade.riskCategory] = { trades: 0, wins: 0, profit: 0 };
            }
            analytics.byRisk[trade.riskCategory].trades++;
            if (trade.result === 'WIN') analytics.byRisk[trade.riskCategory].wins++;
            analytics.byRisk[trade.riskCategory].profit += trade.profit || 0;
        }
    });
    
    // Calculate win rates for each category
    Object.keys(analytics.byRegime).forEach(key => {
        analytics.byRegime[key].winRate = analytics.byRegime[key].wins / analytics.byRegime[key].trades;
    });
    Object.keys(analytics.byAgent).forEach(key => {
        analytics.byAgent[key].winRate = analytics.byAgent[key].wins / analytics.byAgent[key].trades;
    });
    Object.keys(analytics.byMood).forEach(key => {
        analytics.byMood[key].winRate = analytics.byMood[key].wins / analytics.byMood[key].trades;
    });
    Object.keys(analytics.byTimeSession).forEach(key => {
        analytics.byTimeSession[key].winRate = analytics.byTimeSession[key].wins / analytics.byTimeSession[key].trades;
    });
    Object.keys(analytics.byRisk).forEach(key => {
        analytics.byRisk[key].winRate = analytics.byRisk[key].wins / analytics.byRisk[key].trades;
    });
    
    // Recent trend (last 20 trades)
    const recent20 = hist.slice(0, 20);
    analytics.recentTrend = {
        trades: recent20.length,
        wins: recent20.filter(t => t.result === 'WIN').length,
        winRate: recent20.filter(t => t.result === 'WIN').length / recent20.length,
        profit: recent20.reduce((sum, t) => sum + (t.profit || 0), 0),
        avgConfidence: recent20.reduce((sum, t) => sum + (t.confidence || 0), 0) / recent20.length
    };
    
    return analytics;
}

/* ---------- Export Functions ---------- */
// Ensure these functions are accessible to other modules
if (typeof window !== 'undefined') {
    window.optimizeTradeDuration = optimizeTradeDuration;
    window.advancedDecisionEngine = advancedDecisionEngine;
    window.updatePerformanceMetrics = updatePerformanceMetrics;
    window.simulateTrade = simulateTrade;
    window.requestLiveProposal = requestLiveProposal;
    window.getPerformanceAnalytics = getPerformanceAnalytics;
    window.marketMood = marketMood;
    window.getTemporalContext = getTemporalContext;
    window.analyzeHistoricalContext = analyzeHistoricalContext;
    window.assessTradeRisk = assessTradeRisk;
    window.calculateDecisionQuality = calculateDecisionQuality;
}
