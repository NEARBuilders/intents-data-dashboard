import type {
  AssetType,
  LiquidityDepthType,
  RateType,
  RouteType,
  TimeWindow,
  VolumeWindowType
} from '@data-provider/shared-contract';

/**
 * Base service class that all data provider plugins should extend.
 * 
 * @template TAsset - The asset type used by this service (defaults to canonical AssetType).
 * Plugins working with provider-specific formats should pass their asset type, while
 * plugins using canonical formats can use the default.
 */
export abstract class DataProviderService<TAsset = AssetType> {
  /**
   * Transform canonical AssetType to provider-specific asset format.
   * Used for input conversion (e.g., middleware transformations).
   */
  abstract transformAssetToProvider(asset: AssetType): Promise<TAsset>;

  /**
   * Transform provider-specific asset to canonical AssetType format.
   * Used for output conversion (e.g., response transformations).
   */
  abstract transformAssetFromProvider(asset: TAsset): Promise<AssetType>;

  /**
   * Get volume metrics for the specified time windows.
   * Optionally filter by specific route.
   */
  abstract getVolumes(windows: TimeWindow[], route?: RouteType<TAsset>): Promise<VolumeWindowType[]>;

  /**
   * Get list of assets supported by this provider.
   * The asset format depends on the TAsset generic parameter.
   */
  abstract getListedAssets(): Promise<TAsset[]>;

  /**
   * Get rate quotes for route/notional combinations.
   * The asset format in route depends on the TAsset generic parameter.
   */
  abstract getRates(
    route: RouteType<TAsset>,
    notionals: string[]
  ): Promise<RateType<TAsset>[]>;

  /**
   * Get liquidity depth information for route.
   * The asset format in route depends on the TAsset generic parameter.
   */
  abstract getLiquidityDepth(
    route: RouteType<TAsset>
  ): Promise<LiquidityDepthType<TAsset>[]>;
}
