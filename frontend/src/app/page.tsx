"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PXE } from "@aztec/aztec.js/interfaces/pxe";
import { AztecAddressLike, Wallet } from "@aztec/aztec.js";

import Account from "./_components/account";
import {
  TokenContractWrapper,
  TokenNoteLike,
} from "@/lib/token-contract-wrapper";
import Shield from "./_components/shield";
import { AttestorContractWrapper } from "@/lib/attestor-contract-wrapper";
import Attestor from "./_components/attestor";
import Transfer from "./_components/transfer";
import Unshield from "./_components/unshield";

const NAME = "TestToken";
const SYMBOL = "TT";
const DECIMALS = 18;

const NUM_ACCOUNTS_DEFAULT = 2;
const NUM_ATTESTORS_DEFAULT = 2;
const MINT_AMOUNT = 100n;

type Environment = {
  pxe: PXE;
  deployerWallet: Wallet;
  tokenContract: TokenContractWrapper;
};

export type AccountState = {
  wallet: Wallet;
  publicBalance: bigint;
  notes: TokenNoteLike[];
};

export type AttestorState = {
  contract: AttestorContractWrapper;
  blacklist: bigint[];
};

const privateBalance = (
  account: AccountState | undefined,
): bigint | undefined =>
  account?.notes.reduce((acc, note) => acc + note.amount, 0n);

export default function Page() {
  const isMounted = useRef(false);
  const [environment, setEnvironment] = useState<Environment>();

  const [accountStates, setAccountStates] = useState<
    (AccountState | undefined)[]
  >(Array(NUM_ACCOUNTS_DEFAULT));
  const [selectedAccountIndex0, setSelectedAccountIndex0] = useState<number>(0);
  const [selectedAccountIndex1, setSelectedAccountIndex1] = useState<number>(1);

  const [attestorStates, setAttestorStates] = useState<
    (AttestorState | undefined)[]
  >(Array(NUM_ATTESTORS_DEFAULT));
  const [selectedAttestorIndex, setSelectedAttestorIndex] = useState<number>(0);

  const pxe = environment?.pxe;
  const deployerWallet = environment?.deployerWallet;
  const tokenContract = environment?.tokenContract;
  const tokenAddress = tokenContract?.getAddress();

  const selectedAccount0 = accountStates[selectedAccountIndex0];
  const selectedAccount1 = accountStates[selectedAccountIndex1];
  const selectedAttestor = attestorStates[selectedAttestorIndex];

  const addOrReplaceAccount = useCallback(
    async (
      index: number,
      pxe: PXE,
      tokenContract: TokenContractWrapper,
    ): Promise<AccountState> => {
      const { GrumpkinScalar } = await import("@aztec/circuits.js");
      const { AccountManager } = await import("@aztec/aztec.js");
      const { SingleKeyAccountContract } = await import(
        "@aztec/accounts/single_key"
      );

      console.log("Deploying account");
      const deployerPrivateKey = GrumpkinScalar.random();
      const deployerAccount = new AccountManager(
        pxe,
        deployerPrivateKey,
        new SingleKeyAccountContract(deployerPrivateKey),
      );
      const wallet = await deployerAccount.register();
      const address = wallet.getAddress();

      await tokenContract!.mintPublic(address, MINT_AMOUNT);
      const balance = await tokenContract.balanceOfPublic(address);
      const notes = await tokenContract.getNotes(address);
      const newState = {
        wallet,
        publicBalance: balance,
        notes,
      };
      setAccountStates((oldAccountStates: (AccountState | undefined)[]) => {
        const newAccountStates = [...oldAccountStates];
        if (index < newAccountStates.length) {
          newAccountStates[index] = newState;
        } else {
          newAccountStates.push(newState);
        }
        return newAccountStates;
      });
      return newState;
    },
    [],
  );

  const addOrReplaceAttestor = useCallback(
    async (
      index: number,
      deployerWallet: Wallet,
      tokenAddress: AztecAddressLike,
    ): Promise<AttestorState> => {
      const { Fr } = await import("@aztec/aztec.js");
      const { AttestorContract } = await import("../artifacts/Attestor");
      const { AttestorContractWrapper } = await import(
        "@/lib/attestor-contract-wrapper"
      );

      console.log("Deploying attestor");
      const attestorContract = await AttestorContract.deploy(
        deployerWallet,
        deployerWallet.getCompleteAddress().address,
      )
        .send({
          contractAddressSalt: Fr.random(),
        })
        .deployed();

      const attestorContractWrapper = new AttestorContractWrapper(
        attestorContract,
      );
      const newState = {
        contract: attestorContractWrapper,
        blacklist: await attestorContractWrapper.getBlacklist(tokenAddress),
      };
      setAttestorStates((oldAttestorStates: (AttestorState | undefined)[]) => {
        const newAttestorStates = [...oldAttestorStates];
        if (index < newAttestorStates.length) {
          newAttestorStates[index] = newState;
        } else {
          newAttestorStates.push(newState);
        }
        return newAttestorStates;
      });
      return newState;
    },
    [],
  );

  const callShield = useCallback(
    async (
      tokenContract: TokenContractWrapper | undefined,
      wallet: Wallet | undefined,
      selectedAccountIndex: number,
      amount: bigint,
    ) => {
      console.log("Shielding tokens");
      await tokenContract!.withWallet(wallet!).shield(wallet!, amount!);
      const balance = await tokenContract!.balanceOfPublic(
        wallet!.getAddress(),
      );
      const notes = await tokenContract!.getNotes(wallet!.getAddress());
      setAccountStates((oldAccountStates) => {
        const newAccountStates = [...oldAccountStates];
        newAccountStates[selectedAccountIndex]!.publicBalance = balance;
        newAccountStates[selectedAccountIndex]!.notes = notes;
        return newAccountStates;
      });
    },
    [],
  );

  const callUnshield = useCallback(
    async (
      tokenContract: TokenContractWrapper | undefined,
      wallet: Wallet | undefined,
      selectedAccountIndex: number,
      amount: bigint,
    ) => {
      const address = wallet!.getAddress();
      await tokenContract!
        .withWallet(wallet!)
        .unshield(address, address, amount!);
      const balance = await tokenContract!.balanceOfPublic(
        wallet!.getAddress(),
      );
      const notes = await tokenContract!.getNotes(wallet!.getAddress());
      setAccountStates((oldAccountStates) => {
        const newAccountStates = [...oldAccountStates];
        newAccountStates[selectedAccountIndex]!.publicBalance = balance;
        newAccountStates[selectedAccountIndex]!.notes = notes;
        return newAccountStates;
      });
    },
    [],
  );

  const callRequestAttestation = useCallback(
    async (
      tokenContract: TokenContractWrapper | undefined,
      from: Wallet | undefined,
      attestorContract: AttestorContractWrapper | undefined,
      selectedAccountIndex: number,
    ) => {
      const fromAddress = from!.getAddress();
      console.log("Requesting attestation");
      await tokenContract!
        .withWallet(from!)
        .requestAttestation(fromAddress, attestorContract!);
      const notes = await tokenContract!.getNotes(fromAddress);
      setAccountStates((oldAccountStates) => {
        const newAccountStates = [...oldAccountStates];
        newAccountStates[selectedAccountIndex]!.notes = notes;
        return newAccountStates;
      });
    },
    [],
  );

  const callTransfer = useCallback(
    async (
      tokenContract: TokenContractWrapper | undefined,
      from: Wallet | undefined,
      to: AztecAddressLike | undefined,
      selectedAccountIndex0: number,
      selectedAccountIndex1: number,
      amount: bigint,
    ) => {
      const fromAddress = from!.getAddress();
      console.log("Transferring tokens");
      await tokenContract!
        .withWallet(from!)
        .transfer(fromAddress, to!, amount!);
      const notes1 = await tokenContract!.getNotes(fromAddress);
      const notes2 = await tokenContract!.getNotes(to!);
      setAccountStates((oldAccountStates) => {
        const newAccountStates = [...oldAccountStates];
        newAccountStates[selectedAccountIndex0]!.notes = notes1;
        newAccountStates[selectedAccountIndex1]!.notes = notes2;
        return newAccountStates;
      });
    },
    [],
  );

  useEffect(() => {
    if (isMounted.current) {
      (async () => {
        console.log("Importing modules");
        const { createPXEClient } = await import("@aztec/aztec.js");
        const pxe = createPXEClient(
          process.env.PXE_URL || "http://localhost:8080",
        );
        const { GrumpkinScalar } = await import("@aztec/circuits.js");
        const { AccountManager } = await import("@aztec/aztec.js");
        const { SingleKeyAccountContract } = await import(
          "@aztec/accounts/single_key"
        );

        const deployerPrivateKey = GrumpkinScalar.random();
        const deployerAccount = new AccountManager(
          pxe,
          deployerPrivateKey,
          new SingleKeyAccountContract(deployerPrivateKey),
        );
        const deployerWallet = await deployerAccount.register();

        const { Fr } = await import("@aztec/aztec.js");
        const { TokenContract } = await import("../artifacts/Token");
        const { TokenContractWrapper } = await import(
          "@/lib/token-contract-wrapper"
        );

        console.log("Deploying token contract");
        const tokenContract = await TokenContract.deploy(
          deployerWallet,
          deployerWallet.getCompleteAddress().address,
          NAME,
          SYMBOL,
          DECIMALS,
        )
          .send({
            contractAddressSalt: Fr.random(),
          })
          .deployed();
        const tokenContractWrapper = new TokenContractWrapper(tokenContract);

        setEnvironment({
          pxe,
          deployerWallet,
          tokenContract: tokenContractWrapper,
        });

        let accountPromises = [...Array(NUM_ACCOUNTS_DEFAULT).keys()].map((i) =>
          addOrReplaceAccount(i, pxe, tokenContractWrapper),
        );
        let attestorPromises = [...Array(NUM_ACCOUNTS_DEFAULT).keys()].map(
          (i) =>
            addOrReplaceAttestor(
              i,
              deployerWallet,
              tokenContractWrapper.getAddress(),
            ),
        );

        const account0 = await accountPromises[0];
        await callShield(tokenContractWrapper, account0!.wallet, 0, 10n);
        await callShield(tokenContractWrapper, account0!.wallet, 0, 10n);

        const attestor0 = await attestorPromises[0];
        await callRequestAttestation(
          tokenContractWrapper,
          account0?.wallet,
          attestor0!.contract,
          0,
        );

        await callShield(tokenContractWrapper, account0!.wallet, 0, 10n);

        const attestor1 = await attestorPromises[1];
        await callRequestAttestation(
          tokenContractWrapper,
          account0?.wallet,
          attestor1!.contract,
          0,
        );

        const account1 = await accountPromises[1];
        await callTransfer(
          tokenContractWrapper,
          account0!.wallet,
          account1!.wallet.getAddress(),
          0,
          1,
          15n,
        );
      })();
    }
    return () => {
      isMounted.current = true;
    };
  }, [
    addOrReplaceAccount,
    addOrReplaceAttestor,
    callShield,
    callTransfer,
    callRequestAttestation,
  ]);

  const handleRemoveAccount = () => {
    setAccountStates((oldAccountStates) => {
      const newAccountStates = [...oldAccountStates];
      return newAccountStates.slice(0, oldAccountStates.length - 1);
    });
  };

  const handleRemoveAttestor = () => {
    setAttestorStates((oldAttestorStates) => {
      const newAttestorStates = [...oldAttestorStates];
      return newAttestorStates.slice(0, oldAttestorStates.length - 1);
    });
  };

  const handleSelectAccountIndex0 = (index: number) => {
    setSelectedAccountIndex0(index);
  };

  const handleSelectAttestorIndex = (index: number) => {
    setSelectedAttestorIndex(index);
  };

  const handleAddToBlacklist = useCallback(
    async (
      attestorContract: AttestorContractWrapper | undefined,
      shieldId: bigint,
    ) => {
      if (attestorContract) {
        await attestorContract.addToBlacklist(tokenAddress!, shieldId);
        const blacklist = await attestorContract!.getBlacklist(tokenAddress!);
        setAttestorStates(
          (oldAttestorStates: (AttestorState | undefined)[]) => {
            const newAttestorState = [...oldAttestorStates];
            newAttestorState[selectedAttestorIndex]!.blacklist = blacklist;
            return newAttestorState;
          },
        );
      }
    },
    [tokenAddress, selectedAttestorIndex, setAttestorStates],
  );

  return (
    <main>
      <div className="grid grid-cols-2">
        {accountStates
          .filter((state) => state)
          .map((state, i) => (
            <Account
              key={i}
              address={state!.wallet.getAddress()}
              publicBalance={state!.publicBalance}
              notes={state!.notes || []}
              selected={i === selectedAccountIndex0}
              handleAddToBlacklist={handleAddToBlacklist.bind(
                null,
                selectedAttestor?.contract,
              )}
              onClick={handleSelectAccountIndex0.bind(null, i)}
            />
          ))}
      </div>
      <div>
        <button
          disabled={!pxe || !tokenContract}
          onClick={addOrReplaceAccount.bind(
            null,
            accountStates.length,
            pxe!,
            tokenContract!,
          )}
        >
          Add Account
        </button>
      </div>
      <div>
        <button
          disabled={!pxe || !tokenContract || accountStates.length === 0}
          onClick={handleRemoveAccount}
        >
          Remove Account
        </button>
      </div>
      <Shield
        tokenContract={tokenContract}
        wallet={selectedAccount0?.wallet}
        callShield={callShield.bind(
          null,
          tokenContract,
          selectedAccount0?.wallet,
          selectedAccountIndex0,
        )}
        maxShield={selectedAccount0?.publicBalance || 0n}
      />
      <Unshield
        tokenContract={tokenContract}
        wallet={selectedAccount0?.wallet}
        callUnshield={callUnshield.bind(
          null,
          tokenContract,
          selectedAccount0?.wallet,
          selectedAccountIndex0,
        )}
        maxUnshield={privateBalance(selectedAccount0) || 0n}
      />
      {attestorStates
        .filter((state) => state)
        .map((attestorState, i) => (
          <Attestor
            key={i}
            tokenAddress={tokenContract?.getAddress()}
            attestorIndex={i}
            attestorState={attestorState!}
            setAttestorStates={setAttestorStates}
            handleSelectAttestorIndex={handleSelectAttestorIndex.bind(null, i)}
            selected={i === selectedAttestorIndex}
          />
        ))}
      <div>
        <button
          disabled={!deployerWallet || !tokenAddress}
          onClick={addOrReplaceAttestor.bind(
            null,
            attestorStates.length,
            deployerWallet!,
            tokenAddress!,
          )}
        >
          Add Attestor
        </button>
      </div>
      <div>
        <button
          disabled={!deployerWallet || !tokenAddress}
          onClick={handleRemoveAttestor}
        >
          Remove Attestor
        </button>
      </div>
      <div>
        <button
          disabled={!selectedAccount0 || !selectedAttestor || !tokenContract}
          onClick={callRequestAttestation.bind(
            null,
            tokenContract,
            selectedAccount0?.wallet,
            selectedAttestor?.contract,
            selectedAccountIndex0,
          )}
        >
          Request attestation
        </button>
      </div>
      <Transfer
        tokenContract={tokenContract}
        wallet={selectedAccount0?.wallet}
        callTransfer={callTransfer.bind(
          null,
          tokenContract,
          selectedAccount0?.wallet,
          selectedAccount1?.wallet.getAddress(),
          selectedAccountIndex0,
          selectedAccountIndex1,
        )}
        maxTransfer={selectedAccount0?.publicBalance || 0n}
      />
    </main>
  );
  // }
}
