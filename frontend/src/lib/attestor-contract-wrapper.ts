import { AztecAddressLike, Wallet } from "@aztec/aztec.js";
import { Pedersen } from "@aztec/merkle-tree";

import { AttestorContract } from "../artifacts/Attestor";
import { SparseMerkleTree } from "./smt";

export const DEPTH = 32;
const ABSENT = 0n;
const PRESENT = 1n;

export class AttestorContractWrapper {
  protected blacklist: Map<AztecAddressLike, Set<bigint>> = new Map();
  protected blacklistTree: Map<AztecAddressLike, SparseMerkleTree> = new Map();

  public constructor(protected attestorContract: AttestorContract) {}

  public getAddress() {
    return this.attestorContract.address;
  }

  public withWallet(wallet: Wallet): AttestorContractWrapper {
    return new AttestorContractWrapper(
      this.attestorContract.withWallet(wallet),
    );
  }

  initializeTokenBlacklist(token: AztecAddressLike) {
    if (!this.blacklist.has(token)) {
      this.blacklist.set(token, new Set());
      this.blacklistTree.set(
        token,
        new SparseMerkleTree(DEPTH, new Pedersen()),
      );
    }
  }

  async assertBlacklistRoot(token: AztecAddressLike) {
    this.initializeTokenBlacklist(token);

    const root = await this.attestorContract.methods
      .get_blacklist_root(token)
      .view();
    const storedRoot = this.getRootUnchecked(token);
    if (root !== storedRoot) {
      throw Error("Blacklist root doesn't match: " + root + " " + storedRoot);
    }
  }

  public async addToBlacklist(token: AztecAddressLike, shieldId: bigint) {
    const proof = await this.getSiblingPath(token, shieldId);
    await this.attestorContract.methods
      .add_to_blacklist(token, shieldId, proof)
      .send()
      .wait();
    this.blacklistTree.get(token)!.updateLeaf(PRESENT, shieldId);
    this.blacklist.get(token)?.add(shieldId);

    await this.assertBlacklistRoot(token);
  }

  public async removeFromBlacklist(token: AztecAddressLike, shieldId: bigint) {
    const proof = await this.getSiblingPath(token, shieldId);
    await this.attestorContract.methods
      .remove_from_blacklist(token, shieldId, proof)
      .send()
      .wait();
    this.blacklistTree.get(token)?.updateLeaf(ABSENT, shieldId);
    this.blacklist.get(token)?.delete(shieldId);

    await this.assertBlacklistRoot(token);
  }

  getSiblingPathUnchecked(token: AztecAddressLike, shieldId: bigint): bigint[] {
    return this.blacklistTree.get(token)!.getSiblingPath(shieldId);
  }

  public async getSiblingPath(token: AztecAddressLike, shieldId: bigint) {
    await this.assertBlacklistRoot(token);

    return this.getSiblingPathUnchecked(token, shieldId);
  }

  public async getSiblingPaths(
    token: AztecAddressLike,
    shieldIds: bigint[],
  ): Promise<bigint[][]> {
    await this.assertBlacklistRoot(token);

    let proofs = [];
    for (const shieldId of shieldIds) {
      proofs.push(this.getSiblingPathUnchecked(token, shieldId));
    }
    return proofs;
  }

  public getRootUnchecked(token: AztecAddressLike): bigint {
    return this.blacklistTree.get(token)!.getRoot();
  }

  public async getRoot(token: AztecAddressLike): Promise<bigint> {
    await this.assertBlacklistRoot(token);

    return this.getRootUnchecked(token);
  }

  public async getBlacklist(token: AztecAddressLike): Promise<bigint[]> {
    await this.assertBlacklistRoot(token);

    return Array.from(this.blacklist.get(token)!.values());
  }

  public async has(
    token: AztecAddressLike,
    shieldId: bigint,
  ): Promise<boolean> {
    await this.assertBlacklistRoot(token);

    return this.blacklist.get(token)!.has(shieldId);
  }
}
