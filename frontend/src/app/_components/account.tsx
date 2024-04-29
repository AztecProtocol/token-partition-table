import { AztecAddress, FieldLike } from "@aztec/aztec.js";
import classNames from "classnames";

import TokenNote from "./token-note";
import { TokenNoteLike } from "../../lib/token-contract-wrapper";

export default function Account({
  address,
  publicBalance,
  notes,
  onClick,
  selected,
  handleAddToBlacklist,
}: {
  address: AztecAddress;
  publicBalance: FieldLike | undefined;
  notes: TokenNoteLike[];
  onClick?: React.MouseEventHandler;
  selected?: boolean;
  handleAddToBlacklist: (shieldId: bigint) => void;
}) {
  return (
    <div
      className={classNames({
        "border-4 border-red-500": selected,
      })}
    >
      <div className="cursor-pointer" onClick={onClick}>
        Account: {address.toShortString()}
      </div>
      <div>Public Balance: {publicBalance?.toString()}</div>
      <div>
        Notes:
        <div className="flex flex-row gap-4">
          {notes.map((note: TokenNoteLike, i: number) => (
            <TokenNote
              key={i}
              note={note}
              handleAddToBlacklist={handleAddToBlacklist}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
