import { Field, UInt64, Mina, PrivateKey, PublicKey, AccountUpdate, MerkleTree } from 'o1js';
import { MerkleMap, MerkleMapWitness } from 'o1js';
import { jest, describe, expect, it } from "@jest/globals";
import { AUCTION_FEE, Auction} from './Auction';
import { Bidder, nullifyAccount, randomBid } from "./bidders";
import { MerkleTreeH16 } from './collections';

jest.setTimeout(1000 * 60 * 60 * 1); // 1 hour
const FEE = 150_000_000;
const MAX_BIDDERS = 6;

let proofsEnabled = true;

describe('ZK Reverse Bidding Auction', () => {
  let 
    deployer: { privateKey: PrivateKey, publicKey: PublicKey },
    bidders: Bidder[] = [],
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: Auction,
    bidsMap: MerkleMap,
    biddersCollection: MerkleTreeH16;

  beforeAll(async () => {
    // set network
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);

    // get some local accounts for testing
    deployer = Local.testAccounts[0] ;
    for (let j=0; j < MAX_BIDDERS; j++) {
      bidders[j] = nullifyAccount(Local.testAccounts[j+1]) ;
    }

    // create the auction zkApp 
    if (proofsEnabled) await Auction.compile();
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new Auction(zkAppAddress);

    // create the Merkle maps and tree
    bidsMap = new MerkleMap();
    bidsMap.set(Field(0), Field(0));
    biddersCollection = new MerkleTreeH16();
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployer.publicKey, () => {
      AccountUpdate.fundNewAccount(deployer.publicKey);
      zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployer.privateKey, zkAppPrivateKey]).send();
  }

  it('generates and deploys the `Auction` smart contract', async () => {
    await localDeploy();
    const count = zkApp.biddersCount.get();
    const pot = zkApp.auctionPot.get();
    expect(count).toEqual(UInt64.from(0));
    expect(pot).toEqual(UInt64.from(0));
  });

  it('bidders correctly pay the Auction Fee', async () => {
    let pot = zkApp.auctionPot.get().toBigInt();
    for (let j=0; j < MAX_BIDDERS; j++) {
      let bidder = bidders[j];
      // update transaction
      const txn = await Mina.transaction(
        { sender: bidder.publicKey, fee: FEE }, 
        () => {
          zkApp.depositFee(UInt64.from(AUCTION_FEE), bidder.nullifier);
        }
      );
      await txn.prove();
      await txn.sign([bidder.privateKey]).send();
      const updatedPot = zkApp.auctionPot.get().toBigInt();
      expect(updatedPot).toEqual(pot+BigInt(AUCTION_FEE));
      pot = updatedPot;
    }
  });

  it('verifies bidders have paid the Auction fees', async () => {
    for (let j=0; j < MAX_BIDDERS; j++) {
      let bidder = bidders[j];
      let hasPayed = zkApp.hasDeposit(bidder.nullifier);
      expect(hasPayed).toEqual(Field(1));
    }
  });

  it('makes a set of randon bids, one per bidder', async () => {
    for (let j=0; j < MAX_BIDDERS; j++) {
      let bidder = bidders[j];

      // we add it to the MerkleMap and Tree
      let bid = randomBid();
      biddersCollection.setLeaf(BigInt(j), bidder.nullifier);
      bidsMap.set(bidder.nullifier, bid);

      // transaction
      const txn = await Mina.transaction(
        { sender: bidder.publicKey, fee: FEE }, 
        () => {
          zkApp.makeBid(
            bid, 
            bidder.nullifier,
            biddersCollection.root(),
            biddersCollection.witness(BigInt(j)),
            bidsMap.getRoot(),
            bidsMap.getWitness(bidder.nullifier)
          )
        }
      );
      await txn.prove();
      await txn.sign([bidder.privateKey]).send();
    }
    const counter = zkApp.biddersCount.get();
    expect(counter).toEqual(UInt64.from(MAX_BIDDERS));
  });

  it('process bids and find winner using recusrive ZKProgram', async () => {
    console.log("...")
  });  
});
