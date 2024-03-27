import { jest, describe, expect, it } from "@jest/globals";
import { AUCTION_FEE, Auction} from './Auction';
import { Bidder, nullifyAccount } from "./bidders";
import { Field, UInt64, SelfProof, Mina, PrivateKey, PublicKey, AccountUpdate, Poseidon } from 'o1js';

jest.setTimeout(1000 * 60 * 60 * 1); // 1 hour
const FEE = 150_000_000;
const MAX_BIDDERS = 6;

let proofsEnabled = false;

describe('ZK Reverse Bidding Auction', () => {
  let 
    deployer: { privateKey: PrivateKey, publicKey: PublicKey },
    bidders: Bidder[] = [],
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: Auction;

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

  it('correctly pays the Auction Fee', async () => {
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

      let hasPayed = zkApp.hasDeposit(bidder.nullifier);
      expect(hasPayed).toEqual(Field(1));
    }
  });

  it('verify payment of Auction Fee', async () => {
    for (let j=0; j < MAX_BIDDERS; j++) {
      let bidder = bidders[j];
      let hasPayed = zkApp.hasDeposit(bidder.nullifier);
      expect(hasPayed).toEqual(Field(1));
    }
  });

});
