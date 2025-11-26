import { Network } from "@/lib/aggregator/hooks";
import { ComboboxSelect } from "./combobox-select";

const PINNED_BLOCKCHAIN_SLUGS: string[] = [
  "eth",
  "btc",
  "near",
  "sol",
  "arbitrum",
  "optimism",
  "zcash",
  "base",
  "polygon",
  "bsc",
  "avax",
  "ftm",
  "celo",
];

interface NetworkSelectProps {
  label: string;
  value?: string;
  onChange: (blockchain: string) => void;
  networks?: Network[];
  disabled?: boolean;
  loading?: boolean;
}

export const NetworkSelect = ({
  label,
  value,
  onChange,
  networks = [],
  disabled,
  loading,
}: NetworkSelectProps) => {
  return (
    <ComboboxSelect
      label={label}
      value={value}
      onChange={onChange}
      items={networks}
      loading={loading}
      disabled={disabled}
      getItemValue={(network) => network.blockchain}
      getItemDisplay={(network) => network.displayName}
      getItemIcon={(network) => network.iconUrl}
      getSearchText={(network) =>
        `${network.displayName} ${network.blockchain} ${network.symbol}`
      }
      tagLabel="Blockchain"
      placeholder="Select blockchain"
      searchPlaceholder="Search blockchains..."
      emptyMessage="No blockchains found."
      pinnedValues={PINNED_BLOCKCHAIN_SLUGS}
    />
  );
};
