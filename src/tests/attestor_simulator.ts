import { AztecAddress } from '@aztec/aztec.js';
import { Fr } from '@aztec/foundation/fields';
import { FromBuffer } from '@aztec/foundation/serialize';
import { newTree, SparseTree, Pedersen } from '@aztec/merkle-tree';
import { openTmpStore } from '@aztec/kv-store/utils';

const ABSENT = new Fr(0);
const PRESENT = new Fr(1);
const DEPTH = 32;

export class AttestorSimulator {
  private blacklist: Map<AztecAddress, SparseTree<Buffer>> = new Map();

  constructor() {}

  async initializeTokenBlacklist(token: AztecAddress) {
    const db = openTmpStore();
    const deserializer: FromBuffer<Buffer> = { fromBuffer: b => b };
    await this.blacklist.set(token, await newTree(SparseTree, db, new Pedersen(), 'attestor', deserializer, DEPTH));
  }

  public async addToBlacklist(token: AztecAddress, shieldId: bigint) {
    if (!this.blacklist.has(token)) {
      await this.initializeTokenBlacklist(token);
    }
    await this.blacklist.get(token)!.updateLeaf(PRESENT.toBuffer(), shieldId);
  }

  public async removeFromBlacklist(token: AztecAddress, shieldId: bigint) {
    await this.blacklist.get(token)?.updateLeaf(ABSENT.toBuffer(), shieldId);
  }

  public async getSiblingPath(token: AztecAddress, shieldId: bigint) {
    if (!this.blacklist.has(token)) {
      await this.initializeTokenBlacklist(token);
    }
    return (await this.blacklist.get(token)!.getSiblingPath(shieldId, true))!.toFields();
  }

  public async getSiblingPaths(token: AztecAddress, shieldIds: bigint[]) {
    let proofs = [];
    for (const shieldId of shieldIds) {
      proofs.push(await this.getSiblingPath(token, shieldId));
    }
    return proofs;
  }

  public async getRoot(token: AztecAddress) {
    if (!this.blacklist.has(token)) {
      await this.initializeTokenBlacklist(token);
    }
    return Fr.fromBuffer(await this.blacklist.get(token)!.getRoot(true))!.toBigInt();
  }

  public async isNotBlacklisted(token: AztecAddress, shieldId: bigint) {
    if (!this.blacklist.has(token)) {
      await this.initializeTokenBlacklist(token);
    }
    return Fr.fromBuffer((await this.blacklist.get(token)!.getLeafValue(shieldId, true))!).equals(ABSENT);
  }
}
