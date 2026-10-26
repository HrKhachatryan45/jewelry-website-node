export const ONE_EURO_DEFAULTS = Object.freeze({
  minCutoff: 1.0,
  beta: 0.02,
  dCutoff: 1.0,
});

function smoothingFactor(rate, cutoff) {
  const tau = 1 / (2 * Math.PI * cutoff);
  const period = 1 / rate;
  return 1 / (1 + tau / period);
}

export class OneEuroFilter {
  constructor({ minCutoff = ONE_EURO_DEFAULTS.minCutoff, beta = ONE_EURO_DEFAULTS.beta, dCutoff = ONE_EURO_DEFAULTS.dCutoff } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.reset();
  }

  reset() {
    this.lastTime = null;
    this.lastValue = null;
    this.lastDerivative = 0;
  }

  filter(value, timeSeconds) {
    if (!Number.isFinite(value) || !Number.isFinite(timeSeconds)) return value;
    if (this.lastTime === null || timeSeconds <= this.lastTime) {
      this.lastTime = timeSeconds;
      this.lastValue = value;
      this.lastDerivative = 0;
      return value;
    }
    const rate = 1 / (timeSeconds - this.lastTime);
    const derivative = (value - this.lastValue) * rate;
    const derivativeAlpha = smoothingFactor(rate, this.dCutoff);
    const filteredDerivative = derivativeAlpha * derivative + (1 - derivativeAlpha) * this.lastDerivative;
    const cutoff = this.minCutoff + this.beta * Math.abs(filteredDerivative);
    const alpha = smoothingFactor(rate, cutoff);
    const filteredValue = alpha * value + (1 - alpha) * this.lastValue;
    this.lastTime = timeSeconds;
    this.lastValue = filteredValue;
    this.lastDerivative = filteredDerivative;
    return filteredValue;
  }
}
