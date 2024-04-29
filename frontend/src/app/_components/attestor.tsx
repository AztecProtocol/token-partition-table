import React, { useCallback, useEffect } from "react";
import { AztecAddressLike } from "@aztec/aztec.js";
import classNames from "classnames";

import ShieldId from "./shield-id";
import { AttestorState } from "../page";
import { AttestorContractWrapper } from "@/lib/attestor-contract-wrapper";

export default function Attestor({
  tokenAddress,
  attestorIndex,
  attestorState,
  setAttestorStates,
  selected,
  handleSelectAttestorIndex,
}: {
  tokenAddress: AztecAddressLike | undefined;
  attestorIndex: number;
  attestorState: AttestorState;
  setAttestorStates: React.Dispatch<
    React.SetStateAction<(AttestorState | undefined)[]>
  >;
  selected: boolean;
  handleSelectAttestorIndex: () => void;
}) {
  const attestorContract = attestorState.contract;

  const updateBlacklist = useCallback(
    async (
      tokenAddress: AztecAddressLike,
      attestorContract: AttestorContractWrapper,
    ) => {
      const blacklist = await attestorContract!.getBlacklist(tokenAddress!);
      setAttestorStates((oldAttestorStates: (AttestorState | undefined)[]) => {
        const newAttestorState = [...oldAttestorStates];
        newAttestorState[attestorIndex]!.blacklist = blacklist;
        return newAttestorState;
      });
    },
    [attestorIndex, setAttestorStates],
  );

  const handleRemoveFromBlacklist = async (shieldId: bigint) => {
    await attestorContract!.removeFromBlacklist(tokenAddress!, shieldId!);
    await updateBlacklist(tokenAddress!, attestorContract);
  };

  return (
    <div
      className={classNames({
        "border-4 border-blue-400": selected,
      })}
    >
      <div className={"cursor-pointer"} onClick={handleSelectAttestorIndex}>
        Attestor:
        {attestorContract.getAddress().toShortString() || ""}
      </div>
      <div>
        Blacklist:
        <div className="flex flex-row">
          {attestorState.blacklist.map((shieldId, i) => (
            <ShieldId
              key={i}
              shieldId={shieldId}
              handleUpdateBlacklist={handleRemoveFromBlacklist}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
