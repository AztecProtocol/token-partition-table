import { Fr } from "@aztec/aztec.js";
import { Hasher } from "@aztec/types/interfaces";

const INITIAL_LEAF = new Fr(0).toBuffer();

const indexToKeyHash = (level: number, index: bigint) => `${level}:${index}`;
const bufferToBigInt = (buffer: Buffer) => Fr.fromBuffer(buffer)!.toBigInt();

export class SparseMerkleTree {
  protected size = 0n;
  protected store: Map<string, Buffer> = new Map();

  private zeroHashes: Buffer[] = [];

  public constructor(
    protected depth: number,
    protected hasher: Hasher,
  ) {
    // Compute the zero values at each layer.
    let current = INITIAL_LEAF;
    for (let i = depth - 1; i >= 0; --i) {
      this.zeroHashes[i] = current;
      current = hasher.hash(current, current);
    }

    this.store.set(indexToKeyHash(0, 0n), current);
  }

  public getDepth() {
    return this.depth;
  }

  public getNumLeaves() {
    return this.size;
  }

  private getLatestValueAtIndex(level: number, index: bigint): Buffer {
    const key = indexToKeyHash(level, index);
    let val = this.store.get(key);
    if (val !== undefined) {
      return val;
    }
    return this.zeroHashes[level - 1];
  }

  protected addLeafAndHashToRoot(leaf: Buffer, index: bigint) {
    const key = indexToKeyHash(this.depth, index);
    let current = leaf;
    this.store.set(key, current);
    let level = this.depth;
    while (level > 0) {
      const isRight = index & 0x01n;
      const sibling = this.getLatestValueAtIndex(
        level,
        isRight ? index - 1n : index + 1n,
      );
      const lhs = isRight ? sibling : current;
      const rhs = isRight ? current : sibling;
      current = this.hasher.hash(lhs, rhs);
      level -= 1;
      index >>= 1n;
      const cacheKey = indexToKeyHash(level, index);
      this.store.set(cacheKey, current);
    }
  }

  public getLeafValueRaw(index: bigint): Buffer {
    return this.getLatestValueAtIndex(this.depth, index);
  }

  public getRoot(): bigint {
    return bufferToBigInt(this.store.get(indexToKeyHash(0, 0n))!);
  }

  public getLeafValue(index: bigint): bigint {
    return bufferToBigInt(this.getLeafValueRaw(index));
  }

  public getSiblingPath(index: bigint): bigint[] {
    const path: bigint[] = [];
    let level = this.depth;
    while (level > 0) {
      const isRight = index & 0x01n;
      const sibling = this.getLatestValueAtIndex(
        level,
        isRight ? index - 1n : index + 1n,
      );
      path.push(bufferToBigInt(sibling));
      level -= 1;
      index >>= 1n;
    }
    return path;
  }

  public updateLeaf(leafRaw: bigint, index: bigint) {
    const leaf = new Fr(leafRaw).toBuffer();
    const insertingZeroElement = leaf.equals(INITIAL_LEAF);
    const originallyZeroElement =
      this.getLeafValueRaw(index).equals(INITIAL_LEAF);
    if (insertingZeroElement && originallyZeroElement) {
      return;
    }
    this.addLeafAndHashToRoot(leaf, index);

    if (insertingZeroElement) {
      this.size -= 1n;
    } else if (originallyZeroElement) {
      this.size += 1n;
    }
  }
}
