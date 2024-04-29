import { PartitionTableLike } from "../../lib/token-contract-wrapper";
import ShieldId from "./shield-id";

export default function PartitionTable({
  partitionTable,
  handleAddToBlacklist,
}: {
  partitionTable: PartitionTableLike;
  handleAddToBlacklist: (shieldId: bigint) => void;
}) {
  return (
    <div>
      <div>Partition Table:</div>
      <div>
        <div>
          shieldIds:
          <div className="flex flex-col">
            {partitionTable.shieldIds.map((shieldId, i) => (
              <ShieldId
                key={i}
                shieldId={shieldId}
                handleUpdateBlacklist={handleAddToBlacklist}
              />
            ))}
          </div>
        </div>
        <div>
          attestations:{" "}
          {partitionTable.attestations
            .map((attestation) => attestation.toShortString())
            .join(", ")}
        </div>
        <div>maxBlockNumber: {partitionTable.maxBlockNumber.toString()}</div>
        <div>isTableCleared: {partitionTable.isTableCleared.toString()}</div>
      </div>
    </div>
  );
}
