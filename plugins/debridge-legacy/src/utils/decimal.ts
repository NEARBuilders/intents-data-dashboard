import Decimal from 'decimal.js';

/**
 * Decimal utilities for precise financial calculations
 * Prevents floating-point arithmetic errors in rate calculations
 */
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
  static sumFees(fees: Array<{ amountUSD?: string | number }>): number {
    if (!Array.isArray(fees)) {
      throw new Error('Fees must be an array');
    }
    
    try {
      return fees.reduce((sum, fee) => {
        if (!fee?.amountUSD) return sum;
        const feeAmount = typeof fee.amountUSD === 'string' ? fee.amountUSD : fee.amountUSD.toString();
        return sum.plus(new Decimal(feeAmount));
      }, new Decimal(0)).toNumber();
    } catch (error) {
      throw new Error(`Fee calculation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate slippage in basis points
   */
  static calculateSlippageBps(
    expectedRate: number,
    actualRate: number
  ): number {
    const expected = new Decimal(expectedRate);
    const actual = new Decimal(actualRate);
    
    if (expected.isZero()) {
      return 0;
    }
    
    return expected.minus(actual).div(expected).times(10000).abs().toNumber();
  }

  /**
   * Normalize amount from smallest units to human-readable
   */
  static normalizeAmount(
    amount: string,
    decimals: number
  ): Decimal {
    return new Decimal(amount).div(new Decimal(10).pow(decimals));
  }

  /**
   * Denormalize amount from human-readable to smallest units
   */
  static denormalizeAmount(
    amount: string | number,
    decimals: number
  ): string {
    const amountStr = typeof amount === 'number' ? amount.toString() : amount;
    return new Decimal(amountStr).times(new Decimal(10).pow(decimals)).toFixed(0, Decimal.ROUND_DOWN);
  }
}

