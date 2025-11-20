export function getChainNamespace(
  blockchain: string,
  address?: string
): { namespace: string; reference: string } {
  const normalizedSlug = blockchain.toLowerCase();
  const hasAddress = address !== undefined && address !== null && address !== '';

  const NON_EVM_CHAINS: Record<
    string,
    { tokenNamespace: string; nativeNamespace: string; nativeReference: string }
  > = {
    sol: {
      tokenNamespace: 'spl',
      nativeNamespace: 'spl',
      nativeReference: 'So11111111111111111111111111111111111111112',
    },
    near: {
      tokenNamespace: 'nep141',
      nativeNamespace: 'native',
      nativeReference: 'coin',
    },
    ton: {
      tokenNamespace: 'native',
      nativeNamespace: 'native',
      nativeReference: 'coin',
    },
    aptos: {
      tokenNamespace: 'aptos-coin',
      nativeNamespace: 'aptos-coin',
      nativeReference: encodeURIComponent('0x1::aptos_coin::AptosCoin'),
    },
    sui: {
      tokenNamespace: 'native',
      nativeNamespace: 'native',
      nativeReference: 'coin',
    },
    btc: {
      tokenNamespace: 'native',
      nativeNamespace: 'native',
      nativeReference: 'coin',
    },
    doge: {
      tokenNamespace: 'native',
      nativeNamespace: 'native',
      nativeReference: 'coin',
    },
    ltc: {
      tokenNamespace: 'native',
      nativeNamespace: 'native',
      nativeReference: 'coin',
    },
    zec: {
      tokenNamespace: 'native',
      nativeNamespace: 'native',
      nativeReference: 'coin',
    },
    xrp: {
      tokenNamespace: 'native',
      nativeNamespace: 'native',
      nativeReference: 'coin',
    },
    tron: {
      tokenNamespace: 'native',
      nativeNamespace: 'native',
      nativeReference: 'coin',
    },
    cardano: {
      tokenNamespace: 'native',
      nativeNamespace: 'native',
      nativeReference: 'coin',
    },
    stellar: {
      tokenNamespace: 'native',
      nativeNamespace: 'native',
      nativeReference: 'coin',
    },
    bera: {
      tokenNamespace: 'erc20',
      nativeNamespace: 'native',
      nativeReference: 'coin',
    },
  };

  const chainDefaults = NON_EVM_CHAINS[normalizedSlug];
  if (chainDefaults) {
    if (hasAddress) {
      return { namespace: chainDefaults.tokenNamespace, reference: address };
    } else {
      return {
        namespace: chainDefaults.nativeNamespace,
        reference: chainDefaults.nativeReference,
      };
    }
  }

  if (hasAddress) {
    return { namespace: 'erc20', reference: address };
  } else {
    return { namespace: 'native', reference: 'coin' };
  }
}
