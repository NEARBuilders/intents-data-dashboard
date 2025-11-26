import Decimal from 'decimal.js';

export class DecimalUtils {
  /**
   * Calculate effective rate with precise decimal arithmetic
   * Preserves raw strings, computes normalized rate
   */
  static calculateEffectiveRate(
    fromAmount: string,
    toAmount: string,
    fromDecimals: number,
    toDecimals: number
  ): number {
    if (!fromAmount || !toAmount || typeof fromDecimals !== 'number' || typeof toDecimals !== 'number' || fromDecimals < 0 || toDecimals < 0) {
      throw new Error('Invalid input parameters for rate calculation');
    }
    
    try {
      const fromDecimal = new Decimal(fromAmount).div(new Decimal(10).pow(fromDecimals));
      const toDecimal = new Decimal(toAmount).div(new Decimal(10).pow(toDecimals));
      
      if (fromDecimal.isZero()) {
        throw new Error('From amount cannot be zero');
      }
      
      return toDecimal.div(fromDecimal).toNumber();
    } catch (error) {
      throw new Error(`Decimal calculation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Sum fee amounts with precision
   */
  static sumFees(fees: Array<{ amountUSD?: string }>): number {
    if (!Array.isArray(fees)) {
      throw new Error('Fees must be an array');
    }
    
    try {
      return fees.reduce((sum, fee) => {
        if (!fee?.amountUSD) return sum;
        return sum.plus(new Decimal(fee.amountUSD));
      }, new Decimal(0)).toNumber();
    } catch (error) {
      throw new Error(`Fee calculation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}