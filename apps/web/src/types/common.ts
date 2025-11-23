export type { AssetType as Asset, RouteType as Route } from '@data-provider/shared-contract';

export interface ProviderInfo {
  id: string;
  label: string;
  supportedData: string[];
}