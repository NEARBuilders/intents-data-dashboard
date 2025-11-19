import type DataProviderTemplatePlugin from "@data-provider/template";
import { createPluginRuntime } from "every-plugin";

declare module "every-plugin" {
  interface RegisteredPlugins {
    "@data-provider/across": typeof DataProviderTemplatePlugin;
    "@data-provider/axelar": typeof DataProviderTemplatePlugin;
    "@data-provider/cbridge": typeof DataProviderTemplatePlugin;
    "@data-provider/cctp": typeof DataProviderTemplatePlugin;
    "@data-provider/debridge": typeof DataProviderTemplatePlugin;
    "@data-provider/layerzero": typeof DataProviderTemplatePlugin;
    "@data-provider/lifi": typeof DataProviderTemplatePlugin;
    "@data-provider/near-intents": typeof DataProviderTemplatePlugin;
    "@data-provider/wormhole": typeof DataProviderTemplatePlugin;
  }
}

// Plugin URLs - hardcoded for cleanliness since these are deployment artifacts
const PLUGIN_URLS = {
  production: {
    "@data-provider/across": "https://elliot-braem-517-data-provider-across-data-provid-4e003b088-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/axelar": "https://elliot-braem-403-data-provider-axelar-usman-data--4c705eff4-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/cbridge": "https://elliot-braem-471-data-provider-cbridge-data-provi-5f2091ce2-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/cctp": "https://elliot-braem-470-data-provider-cctp-data-provider-bb21830cb-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/debridge": "https://elliot-braem-473-data-provider-debridge-data-prov-bfcae6fcd-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/layerzero": "https://elliot-braem-474-data-provider-layerzero-data-pro-78f5bc1cb-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/lifi": "https://elliot-braem-475-data-provider-lifi-data-provider-f8d1b962e-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/near-intents": "https://elliot-braem-539-data-provider-near-intents-data--ecb3b3cff-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/wormhole": "https://elliot-braem-476-data-provider-wormhole-data-prov-2d0649a2a-ze.zephyrcloud.app/remoteEntry.js",
  },
  development: {
    "@data-provider/across": "http://localhost:3017/remoteEntry.js",
    "@data-provider/axelar": "http://localhost:3014/remoteEntry.js",
    "@data-provider/cbridge": "http://localhost:3021/remoteEntry.js",
    "@data-provider/cctp": "http://localhost:3016/remoteEntry.js",
    "@data-provider/debridge": "http://localhost:3018/remoteEntry.js",
    "@data-provider/layerzero": "http://localhost:3015/remoteEntry.js",
    "@data-provider/lifi": "http://localhost:3019/remoteEntry.js",
    "@data-provider/near-intents": "http://localhost:3022/remoteEntry.js",
    "@data-provider/wormhole": "http://localhost:3020/remoteEntry.js",
  }
} as const;

const isDevelopment = false;
const urls = isDevelopment ? PLUGIN_URLS.development : PLUGIN_URLS.production;

const env = {
  DATA_PROVIDER_API_KEY: process.env.DATA_PROVIDER_API_KEY || "",
  NEAR_INTENTS_API_KEY: process.env.NEAR_INTENTS_API_KEY || ""
};

export const runtime = createPluginRuntime({
  registry: {
    "@data-provider/across": { remoteUrl: urls["@data-provider/across"] },
    // "@data-provider/axelar": { remoteUrl: urls["@data-provider/axelar"] },
    // "@data-provider/cbridge": { remoteUrl: urls["@data-provider/cbridge"] },
    // "@data-provider/cctp": { remoteUrl: urls["@data-provider/cctp"] },
    // "@data-provider/debridge": { remoteUrl: urls["@data-provider/debridge"] },
    // "@data-provider/layerzero": { remoteUrl: urls["@data-provider/layerzero"] },
    // "@data-provider/lifi": { remoteUrl: urls["@data-provider/lifi"] },
    "@data-provider/near-intents": { remoteUrl: urls["@data-provider/near-intents"] },
    // "@data-provider/wormhole": { remoteUrl: urls["@data-provider/wormhole"] },
  },
  secrets: env,
});

// Load all configured providers
const across = await runtime.usePlugin("@data-provider/across", {
  variables: {
    baseUrl: process.env.ACROSS_BASE_URL || "https://app.across.to/api",
    timeout: Number(process.env.DATA_PROVIDER_TIMEOUT) || 10000,
  },
  secrets: {
    apiKey: "{{DATA_PROVIDER_API_KEY}}"
  },
});

// const axelar = await runtime.usePlugin("@data-provider/axelar", {
//   variables: {
//     baseUrl: process.env.AXELAR_BASE_URL || "https://api.axelarscan.io",
//     timeout: Number(process.env.DATA_PROVIDER_TIMEOUT) || 10000,
//   },
//   secrets: {
//     apiKey: "{{DATA_PROVIDER_API_KEY}}"
//   },
// });

// const cbridge = await runtime.usePlugin("@data-provider/cbridge", {
//   variables: {
//     baseUrl: process.env.CBRIDGE_BASE_URL || "https://cbridge-prod2.celer.app",
//     timeout: Number(process.env.DATA_PROVIDER_TIMEOUT) || 10000,
//   },
//   secrets: {
//     apiKey: "{{DATA_PROVIDER_API_KEY}}"
//   },
// });

// const cctp = await runtime.usePlugin("@data-provider/cctp", {
//   variables: {
//     baseUrl: process.env.CCTP_BASE_URL || "https://api.circle.com",
//     timeout: Number(process.env.DATA_PROVIDER_TIMEOUT) || 10000,
//   },
//   secrets: {
//     apiKey: "{{DATA_PROVIDER_API_KEY}}"
//   },
// });

// const debridge = await runtime.usePlugin("@data-provider/debridge", {
//   variables: {
//     baseUrl: process.env.DEBRIDGE_BASE_URL || "https://dln.debridge.finance/v1.0",
//     timeout: Number(process.env.DATA_PROVIDER_TIMEOUT) || 10000,
//   },
//   secrets: {
//     apiKey: "{{DATA_PROVIDER_API_KEY}}"
//   },
// });

// const layerzero = await runtime.usePlugin("@data-provider/layerzero", {
//   variables: {
//     baseUrl: process.env.LAYERZERO_BASE_URL || "https://api.layerzero.com",
//     timeout: Number(process.env.DATA_PROVIDER_TIMEOUT) || 10000,
//   },
//   secrets: {
//     apiKey: "{{DATA_PROVIDER_API_KEY}}"
//   },
// });

// const lifi = await runtime.usePlugin("@data-provider/lifi", {
//   variables: {
//     baseUrl: process.env.LIFI_BASE_URL || "https://li.quest/v1",
//     timeout: Number(process.env.DATA_PROVIDER_TIMEOUT) || 10000,
//   },
//   secrets: {
//     apiKey: "{{DATA_PROVIDER_API_KEY}}"
//   },
// });

const nearIntents = await runtime.usePlugin("@data-provider/near-intents", {
  variables: {
  },
  secrets: {
    apiKey: "{{NEAR_INTENTS_API_KEY}}"
  },
});

// const wormhole = await runtime.usePlugin("@data-provider/wormhole", {
//   variables: {
//     baseUrl: process.env.WORMHOLE_BASE_URL || "https://api.wormholescan.io/api/v1",
//     timeout: Number(process.env.DATA_PROVIDER_TIMEOUT) || 10000,
//   },
//   secrets: {
//     apiKey: "{{DATA_PROVIDER_API_KEY}}"
//   },
// });

export const plugins = {
  across,
  // axelar,
  // cbridge,
  // cctp,
  // debridge,
  // layerzero,
  // lifi,
  nearIntents
  // wormhole
} as const;

// if (typeof process !== 'undefined') {
//   process.once('SIGTERM', () => runtime.shutdown().then(() => process.exit(0)));
//   process.once('SIGINT', () => runtime.shutdown().then(() => process.exit(0)));
// }
