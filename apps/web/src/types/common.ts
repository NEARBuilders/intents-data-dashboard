export type { RouteType as Route, AssetType as Asset } from '@data-provider/shared-contract';

export interface ProviderInfo {
  id: string;
  label: string;
  supportedData: string[];
}
