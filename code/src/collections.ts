import { Field, PrivateKey, PublicKey, Poseidon } from "o1js";
import { MerkleTree, MerkleWitness } from "o1js";

export { MerkleTreeH16, MTH16Witness };

// the specific Witness type to be used in contracts (max 2024 leafs)
const MERKLE_HEIGHT = 16;
class MTH16Witness extends MerkleWitness(MERKLE_HEIGHT) {}

class MerkleTreeH16 {
    // privates
    private merkleTree: MerkleTree;
    private index: bigint;
    private leafs: Field[];

    constructor() {
      this.merkleTree = new MerkleTree(MERKLE_HEIGHT);
    }

    setLeaf(index: bigint, value: Field): this {
      this.merkleTree.setLeaf(index, value); 
      return this;
    }

    root(): Field {
      return this.merkleTree.getRoot();
    }

    witness(index: bigint): MTH16Witness {
      let witness = this.merkleTree.getWitness(index);
      const circuitWitness = new MTH16Witness(witness);
      return circuitWitness;
    }
}
