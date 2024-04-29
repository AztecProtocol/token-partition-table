import { TokenNoteLike } from "../../lib/token-contract-wrapper";
import PartitionTable from "./partition-table";

export default function TokenNote({
  note,
  handleAddToBlacklist,
}: {
  note: TokenNoteLike;
  handleAddToBlacklist: (shieldId: bigint) => void;
}) {
  return (
    <div>
      <div>Amount: {note.amount.toString()}</div>
      <PartitionTable
        partitionTable={note.partitionTable}
        handleAddToBlacklist={handleAddToBlacklist}
      />
    </div>
  );
}
