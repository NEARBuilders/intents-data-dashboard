import { logEvent } from "@/lib/analytics";
import type { Asset } from "@/types/common";
import { ComboboxSelect } from "./combobox-select";

interface AssetSelectProps {
  label: string;
  value?: string;
  onChange: (assetId: string) => void;
  assets: Asset[];
  networkBlockchain?: string;
  direction: "source" | "destination";
  disabled?: boolean;
  loading?: boolean;
}

export const AssetSelect = ({
  label,
  value,
  onChange,
  assets,
  networkBlockchain,
  direction,
  disabled,
  loading,
}: AssetSelectProps) => {
  const handleSearchNoResults = (query: string) => {
    logEvent({
      type: "asset_search_no_results",
      direction,
      networkId: networkBlockchain,
      query,
    });
  };

  return (
    <ComboboxSelect
      label={label}
      value={value}
      onChange={onChange}
      items={assets}
      loading={loading}
      disabled={disabled}
      getItemValue={(asset) => asset.assetId}
      getItemDisplay={(asset) => asset.symbol}
      getItemIcon={(asset) => asset.iconUrl}
      getSearchText={(asset) => `${asset.symbol} ${asset.assetId}`}
      tagLabel="Asset"
      placeholder="Select asset"
      searchPlaceholder="Search tokens..."
      emptyMessage="No assets found."
      onSearchNoResults={handleSearchNoResults}
    />
  );
};
