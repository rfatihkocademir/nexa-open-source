export type QualityDimensionInput = {
    passed: number;
    executed: number;
    total: number;
    approvedTestCases: number;
    totalTestCases: number;
    tracedWorkItems: number;
    totalWorkItems: number;
    openDefects: { critical: number; high: number; medium: number; low: number };
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** 95% Wilson score interval. Stable for small samples and extreme pass rates. */
export function wilsonInterval(successes: number, trials: number, z = 1.959963984540054) {
    if (trials <= 0) return { lower: 0, upper: 0 };
    const p = clamp01(successes / trials);
    const z2 = z * z;
    const denominator = 1 + z2 / trials;
    const center = (p + z2 / (2 * trials)) / denominator;
    const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials)) / denominator;
    return { lower: clamp01(center - margin), upper: clamp01(center + margin) };
}

/** Weighted geometric mean prevents one excellent dimension from hiding a zero. */
function geometricScore(dimensions: Array<{ value: number; weight: number }>) {
    const floor = 0.001;
    const weightTotal = dimensions.reduce((sum, item) => sum + item.weight, 0);
    return Math.exp(dimensions.reduce((sum, item) => sum + item.weight * Math.log(Math.max(floor, clamp01(item.value))), 0) / weightTotal);
}

export function calculateQualityDimensions(input: QualityDimensionInput) {
    const rawPassRate = input.executed > 0 ? clamp01(input.passed / input.executed) : 0;
    const executionRate = input.total > 0 ? clamp01(input.executed / input.total) : 0;
    const coverageRate = input.totalTestCases > 0 ? clamp01(input.approvedTestCases / input.totalTestCases) : 0;
    const traceabilityRate = input.totalWorkItems > 0 ? clamp01(input.tracedWorkItems / input.totalWorkItems) : 0;
    const confidence = wilsonInterval(input.passed, input.executed);
    const evidenceConfidence = input.executed > 0 ? 1 - Math.exp(-input.executed / 30) : 0;
    const defectRiskPoints = input.openDefects.critical * 13 + input.openDefects.high * 5 + input.openDefects.medium * 2 + input.openDefects.low * 0.5;
    const defectIntegrity = Math.exp(-defectRiskPoints / Math.max(5, input.totalWorkItems));
    const score = geometricScore([
        { value: confidence.lower, weight: 0.28 },
        { value: executionRate, weight: 0.16 },
        { value: coverageRate, weight: 0.16 },
        { value: traceabilityRate, weight: 0.12 },
        { value: defectIntegrity, weight: 0.20 },
        { value: evidenceConfidence, weight: 0.08 },
    ]);
    return {
        qualityScore: Number((score * 100).toFixed(2)),
        rawPassRate: Number((rawPassRate * 100).toFixed(2)),
        passConfidenceLower: Number((confidence.lower * 100).toFixed(2)),
        passConfidenceUpper: Number((confidence.upper * 100).toFixed(2)),
        executionRate: Number((executionRate * 100).toFixed(2)),
        coverageRate: Number((coverageRate * 100).toFixed(2)),
        traceabilityRate: Number((traceabilityRate * 100).toFixed(2)),
        defectIntegrity: Number((defectIntegrity * 100).toFixed(2)),
        evidenceConfidence: Number((evidenceConfidence * 100).toFixed(2)),
        defectRiskPoints: Number(defectRiskPoints.toFixed(2)),
    };
}

/** Least-squares slope and EWMA expose direction without overreacting to one run. */
export function calculateRegressionTrend(passRates: number[]) {
    if (passRates.length === 0) return { sampleSize: 0, slope: 0, ewma: 0, direction: 'INSUFFICIENT_DATA' as const, volatility: 0 };
    const meanX = (passRates.length - 1) / 2;
    const meanY = passRates.reduce((sum, value) => sum + value, 0) / passRates.length;
    const denominator = passRates.reduce((sum, _value, index) => sum + Math.pow(index - meanX, 2), 0);
    const slope = denominator ? passRates.reduce((sum, value, index) => sum + (index - meanX) * (value - meanY), 0) / denominator : 0;
    const alpha = 0.35;
    const ewma = passRates.slice(1).reduce((current, value) => alpha * value + (1 - alpha) * current, passRates[0]);
    const variance = passRates.reduce((sum, value) => sum + Math.pow(value - meanY, 2), 0) / passRates.length;
    const direction = passRates.length < 3 ? 'INSUFFICIENT_DATA' : slope > 0.35 ? 'IMPROVING' : slope < -0.35 ? 'DEGRADING' : 'STABLE';
    return { sampleSize: passRates.length, slope: Number(slope.toFixed(2)), ewma: Number(ewma.toFixed(2)), direction, volatility: Number(Math.sqrt(variance).toFixed(2)) };
}

export function deriveQualityTier(score: number): { tier: 'TIER_1' | 'TIER_2' | 'TIER_3'; label: string; color: string } {
    if (score >= 85) {
        return { tier: 'TIER_1', label: 'TIER 1 (ENTERPRISE EXCELLENT)', color: 'emerald' };
    }
    if (score >= 70) {
        return { tier: 'TIER_2', label: 'TIER 2 (STABLE QUALITY)', color: 'indigo' };
    }
    return { tier: 'TIER_3', label: 'TIER 3 (NEEDS ATTENTION)', color: 'amber' };
}
