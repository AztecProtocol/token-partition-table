import { Wallet } from "@aztec/aztec.js";
import React, { useState } from "react";

import { TokenContractWrapper } from "@/lib/token-contract-wrapper";

const DEFAULT_AMOUNT = 10n;

export default function Shield({
  tokenContract,
  wallet,
  maxShield,
  callShield,
}: {
  tokenContract: TokenContractWrapper | undefined;
  wallet: Wallet | undefined;
  maxShield: bigint;
  callShield: (amount: bigint) => void;
}) {
  const [amount, setAmount] = useState<bigint | null>(DEFAULT_AMOUNT);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value ? BigInt(value) : null);
  };

  return (
    <div>
      <input
        type="number"
        value={amount?.toString() || ""}
        onChange={handleChange}
        placeholder="0"
      ></input>
      <button
        disabled={!tokenContract || !wallet || !amount || amount > maxShield}
        onClick={callShield.bind(null, amount!)}
      >
        Shield
      </button>
    </div>
  );
}
