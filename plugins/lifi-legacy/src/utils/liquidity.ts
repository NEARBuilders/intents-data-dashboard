import Decimal from 'decimal.js';
import { HttpUtils } from './http';

interface LiFiQuote {
  estimate: {
    fromAmount: string;
    toAmount: string;
    feeCosts: Array<{ amount: string; amountUSD?: string }>;
  };
}

export class LiquidityProber {
  /**
   * Binary search to find maximum liquidity at given slippage threshold
   */
  static async findMaxLiquidity(
    baseUrl: string,
    route: { source: any; destination: any },
    slippageBps: number,
    maxIterations = 5
  ): Promise<string> {
    const slippage = slippageBps / 10000; // Convert bps to decimal
    
    // Start with reasonable bounds
    let minAmount = new Decimal('1000000'); // 1 USDC (6 decimals)
    let maxAmount = new Decimal('100000000000'); // 100k USDC
    let bestAmount = minAmount;

    for (let i = 0; i < maxIterations; i++) {
      const testAmount = minAmount.plus(maxAmount).div(2);
      
      try {
        const url = new URL(`${baseUrl}/quote`);
        url.searchParams.set('fromChain', route.source.chainId);
        url.searchParams.set('toChain', route.destination.chainId);
        url.searchParams.set('fromToken', route.source.assetId);
        url.searchParams.set('toToken', route.destination.assetId);
        url.searchParams.set('fromAmount', testAmount.toString());
        url.searchParams.set('slippage', slippage.toString());

  await HttpUtils.fetchWithRetry<LiFiQuote>(url.toString(), {}, 0, 200);
        
        // Quote succeeded, try larger amount
        bestAmount = testAmount;
        minAmount = testAmount;
      } catch {
        // Quote failed, try smaller amount
        maxAmount = testAmount;
      }

      // Convergence check
      if (maxAmount.minus(minAmount).div(minAmount).lt(0.1)) {
        break;
      }
    }

    return bestAmount.toString();
  }
}