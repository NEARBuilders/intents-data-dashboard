import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '.env') });

export default {
  variables: {
    nearNetwork: process.env.NEAR_NETWORK || 'testnet',
  },
  secrets: {
    relayerAccountId: process.env.RELAYER_ACCOUNT_ID || '',
    relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY || '',
  },
};
