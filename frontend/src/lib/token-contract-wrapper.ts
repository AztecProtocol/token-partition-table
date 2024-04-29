import {
  AztecAddress,
  AztecAddressLike,
  ExtendedNote,
  Fr,
  Note,
  Wallet,
  computeMessageSecretHash,
} from "@aztec/aztec.js";

import { TokenContract } from "../artifacts/Token";
import { AttestorContractWrapper, DEPTH } from "./attestor-contract-wrapper";

const BOUNDED_VEC_LEN = 6;
const MAX_NOTES_PER_PAGE = 10;

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export type PartitionTableLike = {
  shieldIds: bigint[];
  attestations: AztecAddress[];
  maxBlockNumber: Number;
  isTableCleared: boolean;
};

export type TokenNoteLike = {
  amount: bigint;
  partitionTable: PartitionTableLike;
};

export class TokenContractWrapper {
  public constructor(protected tokenContract: TokenContract) {}

  public getAddress() {
    return this.tokenContract.address;
  }

  public withWallet(wallet: Wallet): TokenContractWrapper {
    return new TokenContractWrapper(this.tokenContract.withWallet(wallet));
  }

  public async mintPublic(to: AztecAddressLike, amount: bigint) {
    await this.tokenContract.methods.mint_public(to, amount).send().wait();
  }

  public async shield(fromWallet: Wallet, amount: bigint) {
    const secret = Fr.random();
    const secretHash = computeMessageSecretHash(secret);
    const receipt = await this.tokenContract.methods
      .shield(fromWallet.getAddress(), amount, secretHash, 0)
      .send()
      .wait();

    const txHash = receipt.txHash;
    const blockNumber = receipt.blockNumber!;

    const storageSlot = new Fr(5); // The storage slot of `pending_shields` is 5.
    const noteTypeId = new Fr(84114971101151129711410111011678111116101n); // TransparentNote

    const note = new Note([new Fr(amount), new Fr(blockNumber), secretHash]);
    const extendedNote = new ExtendedNote(
      note,
      fromWallet.getAddress(),
      this.tokenContract.address,
      storageSlot,
      noteTypeId,
      txHash,
    );
    await fromWallet.addNote(extendedNote);

    const numShields = await this.tokenContract.methods.num_shields().view();
    await this.tokenContract.methods
      .redeem_shield(
        fromWallet.getAddress(),
        amount,
        blockNumber,
        secret,
        numShields,
      )
      .send()
      .wait();
  }

  public async unshield(
    from: AztecAddressLike,
    to: AztecAddressLike,
    amount: bigint,
  ) {
    await this.tokenContract.methods
      .unshield(from, to, amount, 0)
      .send()
      .wait();
  }

  public async requestAttestation(
    from: AztecAddressLike,
    attestor: AttestorContractWrapper,
  ) {
    const address = this.getAddress();
    let root = await attestor.getRoot(address);

    let numBlacklistedNotes = 0n;
    let prevUnattestedNote = null;
    while (true) {
      const firstUnattestedNote = await this.unattestedNoteAtOffset(
        from,
        attestor.getAddress(),
        numBlacklistedNotes,
      );
      if (!firstUnattestedNote) {
        break;
      }

      if (
        JSON.stringify(firstUnattestedNote) ===
        JSON.stringify(prevUnattestedNote)
      ) {
        numBlacklistedNotes += 1n;
      } else {
        console.log("numBlacklistedNotes", numBlacklistedNotes);
        console.log("firstUnattestedNote", firstUnattestedNote);
        console.log("prevUnattestedNote", prevUnattestedNote);

        const proofs = await attestor.getSiblingPaths(
          address,
          firstUnattestedNote.partitionTable.shieldIds,
        );

        const flatProofs = Array(BOUNDED_VEC_LEN * DEPTH).fill(0n);
        for (let i = 0; i < proofs.length; i++) {
          for (let j = 0; j < proofs[i].length; j++) {
            flatProofs[i * BOUNDED_VEC_LEN + j] = proofs[i][j];
          }
        }

        await this.tokenContract.methods
          .request_attestation(
            from,
            attestor.getAddress(),
            numBlacklistedNotes,
            flatProofs,
            root,
            0,
          )
          .send()
          .wait();
      }

      prevUnattestedNote = firstUnattestedNote;
    }
  }

  public async transfer(
    from: AztecAddressLike,
    to: AztecAddressLike,
    amount: bigint,
  ) {
    await this.tokenContract.methods
      .transfer(from, to, amount, 0n)
      .send()
      .wait();
  }

  async unattestedNoteAtOffset(
    owner: AztecAddressLike,
    attestor: AztecAddressLike,
    offset: bigint,
  ): Promise<TokenNoteLike | undefined> {
    const note = await this.tokenContract.methods
      .unattested_note_at_offset(owner, attestor, offset)
      .view();
    if (note._is_some) {
      return {
        amount: this.parseU128(note._value.amount),
        partitionTable: this.parsePartitionTable(note._value.partition_table),
      };
    }
  }

  public async getNotes(owner: AztecAddressLike): Promise<TokenNoteLike[]> {
    const notes = [];
    let offset = 0;

    while (true) {
      const notesAtOffset = await this.tokenContract.methods
        .get_notes_at_offset(owner, offset)
        .view();
      const validNotes = notesAtOffset.filter((note: any) => note._is_some);

      if (validNotes.length === 0) {
        break;
      }

      console.log("validNotes", validNotes);

      notes.push(
        ...validNotes.map((note: any) => ({
          amount: this.parseU128(note._value.amount),
          partitionTable: this.parsePartitionTable(note._value.partition_table),
        })),
      );

      offset += MAX_NOTES_PER_PAGE;
    }

    return notes;
  }

  public async hasAttestation(
    from: AztecAddressLike,
    attestor: AztecAddressLike,
  ): Promise<boolean> {
    return await this.tokenContract.methods
      .has_attestation(from, attestor)
      .view();
  }

  public async balanceOfPrivate(owner: AztecAddressLike): Promise<bigint> {
    return await this.tokenContract.methods.balance_of_private(owner).view();
  }

  public async balanceOfPublic(owner: AztecAddressLike): Promise<bigint> {
    return await this.tokenContract.methods.balance_of_public(owner).view();
  }

  private parseU128(num: any): bigint {
    return (BigInt(num.hi) << 64n) + BigInt(num.lo);
  }

  private parsePartitionTable(partitionTable: any): PartitionTableLike {
    return {
      shieldIds: partitionTable.shield_ids.elems.slice(
        0,
        Number(partitionTable.shield_ids.len),
      ),
      attestations: partitionTable.attestations.elems
        .slice(0, Number(partitionTable.attestations.len))
        .map((attestation: any) => AztecAddress.fromBigInt(attestation)),
      maxBlockNumber: Number(partitionTable.max_block_number),
      isTableCleared: Boolean(partitionTable.is_table_cleared),
    };
  }
}
