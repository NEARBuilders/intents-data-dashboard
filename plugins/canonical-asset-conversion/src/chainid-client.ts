/**
 * ChainID Network Client
 *
 * Dedicated client for fetching EVM chain data from chainid.network
 * Provides clean separation of API concerns and easier testing
 */

import { Effect } from "every-plugin/effect";

export interface EvmChainData {
  name: string;
  chain: string;
  chainId: number;
  networkId: number;
  shortName: string;
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpc?: string[];
  explorers?: Array<{
    name: string;
    url: string;
    standard: string;
  }>;
}

export class ChainIdNetworkClient {
  private readonly apiUrl = 'https://chainid.network/chains.json';

  /**
   * Fetch all EVM chains from chainid.network
   */
  fetchEvmChains(): Effect.Effect<EvmChainData[], Error> {
    return Effect.tryPromise(async (): Promise<EvmChainData[]> => {
      const response = await fetch(this.apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'canonical-asset-service/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`ChainID Network API failed: ${response.status} ${response.statusText}`);
      }

      const chains = await response.json() as EvmChainData[];

      // Basic validation of response structure
      if (!Array.isArray(chains)) {
        throw new Error('Invalid response: expected array of chains');
      }

      if (chains.length === 0) {
        throw new Error('Empty response: no chains returned from API');
      }

      // Validate required fields on first few items
      for (const chain of chains.slice(0, 3)) {
        if (!chain.name || typeof chain.chainId !== 'number') {
          throw new Error(`Invalid chain data: missing required fields`);
        }
      }

      return chains;
    });
  }
}
