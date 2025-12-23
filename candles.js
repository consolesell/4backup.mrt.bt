// candles.js

/* ---------- Advanced Math & Indicators ---------- */
function calcMA(values, period = 14) {
    const res = [];
    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) {
            res.push(null);
            continue;
        }
        const slice = values.slice(i - period + 1, i + 1);
        res.push(slice.reduce((a, b) => a + b, 0) / period);
    }
    return res;
}

function calcEMA(values, period = 14) {
    const res = [];
    const k = 2 / (period + 1);
    for (let i = 0; i < values.length; i++) {
        if (i === 0) {
            res.push(values[i]);
        } else {
            res.push(values[i] * k + res[i - 1] * (1 - k));
        }
    }
    return res;
}

function calcRSI(values, period = 14) {
    if (values.length <= period) return Array(values.length).fill(null);
    const gains = [], losses = [];
    for (let i = 1; i < values.length; i++) {
        const d = values[i] - values[i - 1];
        gains.push(Math.max(0, d));
        losses.push(Math.max(0, -d));
    }
    const rsi = Array(values.length).fill(null);
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    for (let i = period + 1; i < values.length; i++) {
        const g = gains[i - 1], l = losses[i - 1];
        avgGain = (avgGain * (period - 1) + g) / period;
        avgLoss = (avgLoss * (period - 1) + l) / period;
        rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    }
    return rsi;
}

function calcBollinger(values, period = 20, mult = 2) {
    const res = [];
    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) {
            res.push({ upper: null, middle: null, lower: null });
            continue;
        }
        const slice = values.slice(i - period + 1, i + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
        const std = Math.sqrt(variance);
        res.push({ upper: mean + mult * std, middle: mean, lower: mean - mult * std });
    }
    return res;
}

function calcVolatility(closes, period = 20) {
    if (closes.length < period) return 0;
    const slice = closes.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    return Math.sqrt(variance);
}

function calcMACD(values, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const emaFast = calcEMA(values, fastPeriod);
    const emaSlow = calcEMA(values, slowPeriod);
    const macdLine = emaFast.map((f, i) => f - emaSlow[i]);
    const signalLine = calcEMA(macdLine, signalPeriod);
    const histogram = macdLine.map((m, i) => m - signalLine[i]);
    return { macdLine, signalLine, histogram };
}

function calcATR(candles, period = 14) {
    if (candles.length < period + 1) return Array(candles.length).fill(null);
    const tr = [];
    for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;
        tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }
    const atr = [null];
    let sum = tr.slice(0, period).reduce((a, b) => a + b, 0);
    atr.push(sum / period);
    for (let i = period; i < tr.length; i++) {
        atr.push((atr[atr.length - 1] * (period - 1) + tr[i]) / period);
    }
    return atr;
}

/* ---------- Market Regime Detection ---------- */
function detectMarketRegime(candles) {
    if (candles.length < 50) return { type: 'INSUFFICIENT_DATA', volatility: 0, trend: 0, confidence: 0 };
    
    const closes = candles.map(c => c.close);
    const volatility = calcVolatility(closes, 20);
    const ma20 = calcMA(closes, 20);
    const ma50 = calcMA(closes, 50);
    const atr = calcATR(candles, 14);
    
    const currentPrice = closes[closes.length - 1];
    const ma20Current = ma20[ma20.length - 1];
    const ma50Current = ma50[ma50.length - 1];
    const atrCurrent = atr[atr.length - 1];
    
    // Trend calculation
    const trendStrength = ma20Current && ma50Current ? (ma20Current - ma50Current) / ma50Current : 0;
    const priceVsMA = ma20Current ? (currentPrice - ma20Current) / ma20Current : 0;
    
    // Volatility classification
    const volPercentage = volatility / currentPrice;
    const isHighVol = volPercentage > 0.01;
    const isLowVol = volPercentage < 0.003;
    
    // Regime determination
    let regimeType = 'NEUTRAL';
    let confidence = 0.5;
    
    if (Math.abs(trendStrength) > 0.02 && !isLowVol) {
        regimeType = trendStrength > 0 ? 'STRONG_UPTREND' : 'STRONG_DOWNTREND';
        confidence = 0.85;
    } else if (Math.abs(trendStrength) > 0.01) {
        regimeType = trendStrength > 0 ? 'UPTREND' : 'DOWNTREND';
        confidence = 0.7;
    } else if (isHighVol) {
        regimeType = 'HIGH_VOLATILITY';
        confidence = 0.6;
    } else if (isLowVol) {
        regimeType = 'CONSOLIDATION';
        confidence = 0.65;
    }
    
    return {
        type: regimeType,
        volatility: volPercentage,
        trend: trendStrength,
        confidence,
        atr: atrCurrent
    };
}

/* ---------- Adaptive Indicator Weighting ---------- */
function updateIndicatorWeights(regime, recentPerformance) {
    // Adjust weights based on market regime and historical performance
    switch (regime.type) {
        case 'STRONG_UPTREND':
        case 'STRONG_DOWNTREND':
            indicatorWeights.ma = 1.3;
            indicatorWeights.momentum = 1.4;
            indicatorWeights.rsi = 0.8;
            indicatorWeights.bb = 0.9;
            break;
        case 'HIGH_VOLATILITY':
            indicatorWeights.bb = 1.5;
            indicatorWeights.rsi = 1.2;
            indicatorWeights.ma = 0.7;
            indicatorWeights.momentum = 1.1;
            break;
        case 'CONSOLIDATION':
            indicatorWeights.bb = 1.3;
            indicatorWeights.rsi = 1.4;
            indicatorWeights.ma = 0.6;
            indicatorWeights.momentum = 0.5;
            break;
        default:
            indicatorWeights = { ma: 1.0, rsi: 1.0, bb: 1.0, momentum: 1.0, volume: 1.0 };
    }
    
    // Further refine based on recent win rate
    if (recentPerformance.winRate > 0.65) {
        // Amplify current strategy
        Object.keys(indicatorWeights).forEach(k => indicatorWeights[k] *= 1.1);
    } else if (recentPerformance.winRate < 0.45) {
        // Reduce confidence in current indicators
        Object.keys(indicatorWeights).forEach(k => indicatorWeights[k] *= 0.85);
    }
}

/* ---------- Enhanced Candlestick Pattern Recognition ---------- */
function identifyCandlestickPattern(candles) {
    if (candles.length < 3) return { pattern: 'NONE', strength: 0, signal: 'NEUTRAL' };
    
    const c1 = candles[candles.length - 3];
    const c2 = candles[candles.length - 2];
    const c3 = candles[candles.length - 1];
    
    const body1 = Math.abs(c1.close - c1.open);
    const body2 = Math.abs(c2.close - c2.open);
    const body3 = Math.abs(c3.close - c3.open);
    
    const range1 = c1.high - c1.low;
    const range2 = c2.high - c2.low;
    const range3 = c3.high - c3.low;
    
    const upperWick1 = c1.high - Math.max(c1.open, c1.close);
    const lowerWick1 = Math.min(c1.open, c1.close) - c1.low;
    const upperWick2 = c2.high - Math.max(c2.open, c2.close);
    const lowerWick2 = Math.min(c2.open, c2.close) - c2.low;
    const upperWick3 = c3.high - Math.max(c3.open, c3.close);
    const lowerWick3 = Math.min(c3.open, c3.close) - c3.low;
    
    const isBullish1 = c1.close > c1.open;
    const isBullish2 = c2.close > c2.open;
    const isBullish3 = c3.close > c3.open;
    
    // === EXISTING PATTERNS (keep your original code) ===
    
    // Doji detection
    if (body3 < range3 * 0.1 && range3 > 0) {
        return { pattern: 'DOJI', strength: 0.7, signal: 'REVERSAL_PENDING' };
    }
    
    // Hammer / Inverted Hammer
    if (lowerWick3 > body3 * 2 && upperWick3 < body3 * 0.3 && isBullish3) {
        return { pattern: 'HAMMER', strength: 0.8, signal: 'BULLISH' };
    }
    if (upperWick3 > body3 * 2 && lowerWick3 < body3 * 0.3 && !isBullish3) {
        return { pattern: 'SHOOTING_STAR', strength: 0.8, signal: 'BEARISH' };
    }
    
    // Engulfing patterns
    if (!isBullish2 && isBullish3 && c3.open < c2.close && c3.close > c2.open && body3 > body2 * 1.2) {
        return { pattern: 'BULLISH_ENGULFING', strength: 0.85, signal: 'BULLISH' };
    }
    if (isBullish2 && !isBullish3 && c3.open > c2.close && c3.close < c2.open && body3 > body2 * 1.2) {
        return { pattern: 'BEARISH_ENGULFING', strength: 0.85, signal: 'BEARISH' };
    }
    
    // Three white soldiers / Three black crows
    if (isBullish1 && isBullish2 && isBullish3 && c2.close > c1.close && c3.close > c2.close) {
        return { pattern: 'THREE_WHITE_SOLDIERS', strength: 0.9, signal: 'STRONG_BULLISH' };
    }
    if (!isBullish1 && !isBullish2 && !isBullish3 && c2.close < c1.close && c3.close < c2.close) {
        return { pattern: 'THREE_BLACK_CROWS', strength: 0.9, signal: 'STRONG_BEARISH' };
    }
    
    // === NEW PATTERNS BELOW ===
    
    // Morning Star (Bullish reversal)
    if (!isBullish1 && body2 < range2 * 0.3 && isBullish3 && 
        c2.close < c1.close && c3.close > (c1.open + c1.close) / 2) {
        return { pattern: 'MORNING_STAR', strength: 0.88, signal: 'STRONG_BULLISH' };
    }
    
    // Evening Star (Bearish reversal)
    if (isBullish1 && body2 < range2 * 0.3 && !isBullish3 && 
        c2.close > c1.close && c3.close < (c1.open + c1.close) / 2) {
        return { pattern: 'EVENING_STAR', strength: 0.88, signal: 'STRONG_BEARISH' };
    }
    
    // Piercing Pattern (Bullish reversal)
    if (!isBullish2 && isBullish3 && c3.open < c2.low && 
        c3.close > (c2.open + c2.close) / 2 && c3.close < c2.open) {
        return { pattern: 'PIERCING_PATTERN', strength: 0.82, signal: 'BULLISH' };
    }
    
    // Dark Cloud Cover (Bearish reversal)
    if (isBullish2 && !isBullish3 && c3.open > c2.high && 
        c3.close < (c2.open + c2.close) / 2 && c3.close > c2.open) {
        return { pattern: 'DARK_CLOUD_COVER', strength: 0.82, signal: 'BEARISH' };
    }
    
    // Harami (Bullish)
    if (!isBullish2 && isBullish3 && c3.open > c2.close && 
        c3.close < c2.open && body3 < body2 * 0.5) {
        return { pattern: 'BULLISH_HARAMI', strength: 0.75, signal: 'BULLISH' };
    }
    
    // Harami (Bearish)
    if (isBullish2 && !isBullish3 && c3.open < c2.close && 
        c3.close > c2.open && body3 < body2 * 0.5) {
        return { pattern: 'BEARISH_HARAMI', strength: 0.75, signal: 'BEARISH' };
    }
    
    // Tweezer Bottom (Bullish reversal)
    if (!isBullish2 && isBullish3 && Math.abs(c2.low - c3.low) < range2 * 0.05) {
        return { pattern: 'TWEEZER_BOTTOM', strength: 0.78, signal: 'BULLISH' };
    }
    
    // Tweezer Top (Bearish reversal)
    if (isBullish2 && !isBullish3 && Math.abs(c2.high - c3.high) < range2 * 0.05) {
        return { pattern: 'TWEEZER_TOP', strength: 0.78, signal: 'BEARISH' };
    }
    
    // Hanging Man (Bearish reversal)
    if (lowerWick3 > body3 * 2 && upperWick3 < body3 * 0.5 && 
        isBullish3 && c3.close > c2.close) {
        return { pattern: 'HANGING_MAN', strength: 0.76, signal: 'BEARISH' };
    }
    
    // Inverted Hammer (Bullish reversal)
    if (upperWick3 > body3 * 2 && lowerWick3 < body3 * 0.5 && 
        isBullish3 && c3.close < c2.close) {
        return { pattern: 'INVERTED_HAMMER', strength: 0.76, signal: 'BULLISH' };
    }
    
    // Dragonfly Doji (Bullish reversal)
    if (body3 < range3 * 0.1 && lowerWick3 > range3 * 0.6 && upperWick3 < range3 * 0.1) {
        return { pattern: 'DRAGONFLY_DOJI', strength: 0.77, signal: 'BULLISH' };
    }
    
    // Gravestone Doji (Bearish reversal)
    if (body3 < range3 * 0.1 && upperWick3 > range3 * 0.6 && lowerWick3 < range3 * 0.1) {
        return { pattern: 'GRAVESTONE_DOJI', strength: 0.77, signal: 'BEARISH' };
    }
    
    // Long-Legged Doji (Indecision)
    if (body3 < range3 * 0.1 && lowerWick3 > range3 * 0.3 && upperWick3 > range3 * 0.3) {
        return { pattern: 'LONG_LEGGED_DOJI', strength: 0.72, signal: 'REVERSAL_PENDING' };
    }
    
    // Marubozu Bullish (Strong continuation)
    if (isBullish3 && body3 > range3 * 0.95) {
        return { pattern: 'BULLISH_MARUBOZU', strength: 0.83, signal: 'STRONG_BULLISH' };
    }
    
    // Marubozu Bearish (Strong continuation)
    if (!isBullish3 && body3 > range3 * 0.95) {
        return { pattern: 'BEARISH_MARUBOZU', strength: 0.83, signal: 'STRONG_BEARISH' };
    }
    
    // Spinning Top (Indecision)
    if (body3 < range3 * 0.3 && upperWick3 > body3 && lowerWick3 > body3) {
        return { pattern: 'SPINNING_TOP', strength: 0.65, signal: 'NEUTRAL' };
    }
    
    // Three Inside Up (Bullish reversal)
    if (!isBullish1 && !isBullish2 && isBullish3 && 
        c2.open > c1.close && c2.close < c1.open && 
        c3.close > c1.open && body2 < body1 * 0.5) {
        return { pattern: 'THREE_INSIDE_UP', strength: 0.86, signal: 'STRONG_BULLISH' };
    }
    
    // Three Inside Down (Bearish reversal)
    if (isBullish1 && isBullish2 && !isBullish3 && 
        c2.open < c1.close && c2.close > c1.open && 
        c3.close < c1.open && body2 < body1 * 0.5) {
        return { pattern: 'THREE_INSIDE_DOWN', strength: 0.86, signal: 'STRONG_BEARISH' };
    }
    
    // Three Outside Up (Bullish reversal)
    if (!isBullish1 && !isBullish2 && isBullish3 && 
        c2.open < c1.close && c2.close > c1.open && 
        c3.close > c2.close && body2 > body1) {
        return { pattern: 'THREE_OUTSIDE_UP', strength: 0.87, signal: 'STRONG_BULLISH' };
    }
    
    // Three Outside Down (Bearish reversal)
    if (isBullish1 && isBullish2 && !isBullish3 && 
        c2.open > c1.close && c2.close < c1.open && 
        c3.close < c2.close && body2 > body1) {
        return { pattern: 'THREE_OUTSIDE_DOWN', strength: 0.87, signal: 'STRONG_BEARISH' };
    }
    
    // Rising Three Methods (Bullish continuation)
    if (candles.length >= 5) {
        const c0 = candles[candles.length - 5];
        const c4 = candles[candles.length - 4];
        if (c0.close > c0.open && isBullish3 && 
            !isBullish1 && !isBullish2 && 
            c3.close > c0.close && c1.high < c0.high) {
            return { pattern: 'RISING_THREE_METHODS', strength: 0.84, signal: 'BULLISH' };
        }
    }
    
    // Falling Three Methods (Bearish continuation)
    if (candles.length >= 5) {
        const c0 = candles[candles.length - 5];
        const c4 = candles[candles.length - 4];
        if (c0.close < c0.open && !isBullish3 && 
            isBullish1 && isBullish2 && 
            c3.close < c0.close && c1.low > c0.low) {
            return { pattern: 'FALLING_THREE_METHODS', strength: 0.84, signal: 'BEARISH' };
        }
    }
    
    // Abandoned Baby Bullish (Rare reversal)
    if (!isBullish1 && body2 < range2 * 0.2 && isBullish3 && 
        c2.high < c1.low && c2.high < c3.low) {
        return { pattern: 'ABANDONED_BABY_BULLISH', strength: 0.92, signal: 'STRONG_BULLISH' };
    }
    
    // Abandoned Baby Bearish (Rare reversal)
    if (isBullish1 && body2 < range2 * 0.2 && !isBullish3 && 
        c2.low > c1.high && c2.low > c3.high) {
        return { pattern: 'ABANDONED_BABY_BEARISH', strength: 0.92, signal: 'STRONG_BEARISH' };
    }
    
    // Upside Gap Two Crows (Bearish reversal)
    if (isBullish1 && !isBullish2 && !isBullish3 && 
        c2.open > c1.close && c3.open > c2.open && c3.close < c2.close) {
        return { pattern: 'UPSIDE_GAP_TWO_CROWS', strength: 0.79, signal: 'BEARISH' };
    }
    
    // Mat Hold (Bullish continuation)
    if (candles.length >= 5) {
        const c0 = candles[candles.length - 5];
        if (c0.close > c0.open && isBullish3 && 
            !isBullish1 && c3.close > c0.close) {
            return { pattern: 'MAT_HOLD', strength: 0.81, signal: 'BULLISH' };
        }
    }
    
    // Belt Hold Bullish
    if (isBullish3 && lowerWick3 < body3 * 0.1 && body3 > range3 * 0.7) {
        return { pattern: 'BULLISH_BELT_HOLD', strength: 0.74, signal: 'BULLISH' };
    }
    
    // Belt Hold Bearish
    if (!isBullish3 && upperWick3 < body3 * 0.1 && body3 > range3 * 0.7) {
        return { pattern: 'BEARISH_BELT_HOLD', strength: 0.74, signal: 'BEARISH' };
    }
    
    // Breakaway Bullish (5-candle pattern)
    if (candles.length >= 5) {
        const c0 = candles[candles.length - 5];
        if (!c0.close > c0.open && isBullish3 && c3.close > c0.open) {
            return { pattern: 'BREAKAWAY_BULLISH', strength: 0.80, signal: 'BULLISH' };
        }
    }
    
    // Kicking Bullish
    if (!isBullish2 && isBullish3 && body2 > range2 * 0.9 && body3 > range3 * 0.9 && c3.open > c2.close) {
        return { pattern: 'KICKING_BULLISH', strength: 0.89, signal: 'STRONG_BULLISH' };
    }
    
    // Kicking Bearish
    if (isBullish2 && !isBullish3 && body2 > range2 * 0.9 && body3 > range3 * 0.9 && c3.open < c2.close) {
        return { pattern: 'KICKING_BEARISH', strength: 0.89, signal: 'STRONG_BEARISH' };
    }
    
    // Ladder Bottom (Bullish reversal)
    if (candles.length >= 5) {
        const c0 = candles[candles.length - 5];
        const c4 = candles[candles.length - 4];
        if (!c0.close > c0.open && !c4.close > c4.open && !isBullish1 && 
            !isBullish2 && isBullish3 && c3.close > c2.open) {
            return { pattern: 'LADDER_BOTTOM', strength: 0.85, signal: 'BULLISH' };
        }
    }
    
    // Ladder Top (Bearish reversal)
    if (candles.length >= 5) {
        const c0 = candles[candles.length - 5];
        const c4 = candles[candles.length - 4];
        if (c0.close > c0.open && c4.close > c4.open && isBullish1 && 
            isBullish2 && !isBullish3 && c3.close < c2.open) {
            return { pattern: 'LADDER_TOP', strength: 0.85, signal: 'BEARISH' };
        }
    }
    
    // Concealing Baby Swallow (Bullish continuation)
    if (!isBullish1 && !isBullish2 && !isBullish3 && 
        c2.open < c1.open && c3.open > c2.close && c3.close > c2.open) {
        return { pattern: 'CONCEALING_BABY_SWALLOW', strength: 0.83, signal: 'BULLISH' };
    }
    
    // Stick Sandwich (Bullish reversal)
    if (!isBullish1 && isBullish2 && !isBullish3 && 
        Math.abs(c1.close - c3.close) < body1 * 0.1) {
        return { pattern: 'STICK_SANDWICH', strength: 0.73, signal: 'BULLISH' };
    }
    
    // Homing Pigeon (Bullish reversal)
    if (!isBullish2 && !isBullish3 && c3.open < c2.open && 
        c3.close > c2.close && body3 < body2 * 0.7) {
        return { pattern: 'HOMING_PIGEON', strength: 0.71, signal: 'BULLISH' };
    }
    
    // Matching Low (Bullish reversal)
    if (!isBullish2 && !isBullish3 && Math.abs(c2.close - c3.close) < body2 * 0.1) {
        return { pattern: 'MATCHING_LOW', strength: 0.70, signal: 'BULLISH' };
    }
    
    // Deliberation (Bearish reversal - after uptrend)
    if (isBullish1 && isBullish2 && isBullish3 && 
        body3 < body2 && body2 < body1 && c3.close > c2.close) {
        return { pattern: 'DELIBERATION', strength: 0.76, signal: 'BEARISH' };
    }
    
    // Advance Block (Bearish reversal)
    if (isBullish1 && isBullish2 && isBullish3 && 
        body2 < body1 && body3 < body2 && 
        upperWick2 > upperWick1 && upperWick3 > upperWick2) {
        return { pattern: 'ADVANCE_BLOCK', strength: 0.78, signal: 'BEARISH' };
    }
    
    return { pattern: 'NONE', strength: 0, signal: 'NEUTRAL' };
}


/* ---------- Predictive Micro-Structure Analysis ---------- */
function analyzeMicroStructure(tickBuffer, currentCandle) {
    if (tickBuffer.length < 10) return { momentum: 0, volatility: 0, prediction: 'UNCERTAIN' };
    
    const recentTicks = tickBuffer.slice(-20);
    const prices = recentTicks.map(t => t.quote);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    // Calculate tick momentum
    const momentum = (prices[prices.length - 1] - prices[0]) / prices[0];
    
    // Calculate micro volatility
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
    const microVol = Math.sqrt(variance);
    
    // Predict likely candle formation
    let prediction = 'UNCERTAIN';
    const currentBody = Math.abs(currentCandle.close - currentCandle.open);
    const currentRange = currentCandle.high - currentCandle.low;
    
    if (microVol / avgPrice > 0.001 && momentum > 0.0005) {
        prediction = 'BULLISH_CONTINUATION';
    } else if (microVol / avgPrice > 0.001 && momentum < -0.0005) {
        prediction = 'BEARISH_CONTINUATION';
    } else if (microVol / avgPrice < 0.0003) {
        prediction = 'CONSOLIDATION_LIKELY';
    } else if (currentBody < currentRange * 0.2) {
        prediction = 'DOJI_FORMING';
    }
    
    return {
        momentum,
        volatility: microVol / avgPrice,
        prediction,
        confidence: Math.min(recentTicks.length / 20, 1)
    };
}

/* ---------- Chart ---------- */
function renderChart(candles, indicators) {
    const ctx = document.getElementById('candleChart').getContext('2d');
    const labels = candles.map(c => new Date(c.epoch * 1000).toLocaleTimeString());
    const closes = candles.map(c => c.close);
    const ma14 = indicators.ma14;
    const ma50 = indicators.ma50;
    const rsi = indicators.rsi;
    const bbUpper = indicators.bb.map(b => b.upper);
    const bbMiddle = indicators.bb.map(b => b.middle);
    const bbLower = indicators.bb.map(b => b.lower);
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        data: {
            labels,
            datasets: [
                {
                    type: 'line',
                    label: 'Close',
                    data: closes,
                    borderColor: 'var(--accent-color)',
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y',
                    borderWidth: 2
                },
                {
                    type: 'line',
                    label: 'MA(14)',
                    data: ma14,
                    borderColor: 'var(--error-color)',
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y',
                },
                {
                    type: 'line',
                    label: 'MA(50)',
                    data: ma50,
                    borderColor: '#ff9900',
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y',
                },
                {
                    type: 'line',
                    label: 'BB Upper',
                    data: bbUpper,
                    borderColor: 'var(--warn-color)',
                    borderDash: [6, 4],
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y',
                },
                {
                    type: 'line',
                    label: 'BB Middle',
                    data: bbMiddle,
                    borderColor: 'var(--muted-color)',
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y',
                },
                {
                    type: 'line',
                    label: 'BB Lower',
                    data: bbLower,
                    borderColor: 'var(--success-color)',
                    borderDash: [6, 4],
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y',
                },
                {
                    type: 'line',
                    label: 'RSI(14)',
                    data: rsi,
                    borderColor: '#9966ff',
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y1',
                },
            ]
        },
        options: {
            animation: false,
            plugins: {
                legend: { labels: { color: 'var(--text-color)' } }
            },
            scales: {
                x: { ticks: { color: 'var(--muted-color)' } },
                y: {
                    type: 'linear',
                    position: 'left',
                    ticks: { color: 'var(--muted-color)' },
                    grid: { color: 'var(--border-color)' }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    ticks: { color: '#9966ff' },
                    grid: { drawOnChartArea: false },
                    min: 0,
                    max: 100
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

/* ---------- Fetch & Subscribe ---------- */
function fetchCandles(symbol, granularity, count = CANDLES_COUNT) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return appendFeed('Cannot fetch candles - WS not open', 'error');
    showLoading('Fetching historical candles...');
    const req = {
        ticks_history: symbol,
        end: 'latest',
        count,
        style: 'candles',
        granularity
    };
    try {
        ws.send(JSON.stringify(req));
    } catch (e) {
        appendFeed(`Candles request failed: ${e.message}`, 'error');
        hideLoading();
    }
}

function subscribeToTicks(symbol) {
    const req = {
        ticks: symbol,
        subscribe: 1
    };
    try {
        ws.send(JSON.stringify(req));
        appendFeed(`Subscribed to real-time ticks for ${symbol}`, 'info');
    } catch (e) {
        appendFeed(`Tick subscription failed: ${e.message}`, 'error');
    }
}

/* ---------- Update Functions ---------- */
function updateChartAndIndicators() {
    const closes = candleData.map(c => c.close);
    const ma14 = calcMA(closes, 14);
    const ma50 = calcMA(closes, 50);
    const rsi = calcRSI(closes, 14);
    const bb = calcBollinger(closes, 20, 2);
    renderChart(candleData, { ma14, ma50, rsi, bb });
    
    const indicators = {
        maNow: ma14[ma14.length - 1],
        ma50Now: ma50[ma50.length - 1],
        rsiNow: rsi[rsi.length - 1],
        bbNow: bb[bb.length - 1],
        volatility: calcVolatility(closes, 20),
        pattern: identifyCandlestickPattern(candleData),
        microAnalysis: analyzeMicroStructure(tickBuffer, candleData[candleData.length - 1])
    };
    updateIndicatorsUI(indicators);
}

function updateIndicatorsUI(indicators) {
    const maNow = indicators.maNow ? indicators.maNow.toFixed(4) : '-';
    const ma50Now = indicators.ma50Now ? indicators.ma50Now.toFixed(4) : '-';
    const rsiNow = indicators.rsiNow ? indicators.rsiNow.toFixed(2) : '-';
    const bbNow = indicators.bbNow && indicators.bbNow.middle !== null ? 
        `${indicators.bbNow.upper.toFixed(4)} / ${indicators.bbNow.middle.toFixed(4)} / ${indicators.bbNow.lower.toFixed(4)}` : '-';
    const vol = indicators.volatility ? (indicators.volatility * 100).toFixed(4) + '%' : '-';
    const pattern = indicators.pattern ? `${indicators.pattern.pattern} (${(indicators.pattern.strength * 100).toFixed(0)}%)` : '-';
    const micro = indicators.microAnalysis ? indicators.microAnalysis.prediction : '-';
    
    indList.innerHTML = `
        <li>MA(14): ${maNow} | MA(50): ${ma50Now}</li>
        <li>RSI(14): ${rsiNow}</li>
        <li>BB (U/M/L): ${bbNow}</li>
        <li>Volatility: ${vol}</li>
        <li>Pattern: ${pattern}</li>
        <li>Micro-Structure: ${micro}</li>
        <li>Regime: ${marketRegime.type} (${(marketRegime.confidence * 100).toFixed(0)}%)</li>
        <li>Weights: MA:${indicatorWeights.ma.toFixed(2)} RSI:${indicatorWeights.rsi.toFixed(2)} BB:${indicatorWeights.bb.toFixed(2)}</li>
    `;
}
