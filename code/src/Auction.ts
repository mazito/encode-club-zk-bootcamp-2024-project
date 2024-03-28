import { Field, state, State, method, UInt64, Struct, MerkleMapWitness, PublicKey }  from 'o1js';
import { AccountUpdate, SmartContract, Reducer, Provable }  from 'o1js';
import { MTH16Witness } from "./collections.js"

export { AUCTION_FEE };

const 
  AUCTION_FEE = 3; // Fee is 3 MINA per Bid

const 
  IS_FEE = Field(1),
  IS_BID = Field(2),
  IS_WINNER = Field(3); 

class AuctionAction extends Struct({
  type: Field,
  nullifier: Field,
  deposit: UInt64,
  bid: Field,
  winner: Field,
}) {}

export class Auction extends SmartContract {
  @state(Field) bidsCommitment = State < Field > ();
  @state(Field) biddersCommitment = State < Field > ();
  @state(UInt64) biddersCount = State < UInt64 > ();
  @state(UInt64) auctionPot = State < UInt64 > ();
  @state(Field) winnerNullifier = State < Field > ();
  @state(Field) leastUniqueBid = State < Field > ();
  @state(UInt64) startsUTC = State < UInt64 > ();
  @state(UInt64) endsUTC = State < UInt64 > ();

  reducer = Reducer({ actionType: AuctionAction });  

  init() {
    super.init();
    this.bidsCommitment.set(Field(0));
    this.biddersCommitment.set(Field(0));
    this.biddersCount.set(UInt64.from(0));
    this.auctionPot.set(UInt64.from(0));
    this.winnerNullifier.set(Field(0));
    this.leastUniqueBid.set(Field(0));
    this.startsUTC.set(UInt64.from(0));
    this.endsUTC.set(UInt64.from(0));
  }


  /**
   * Deposits the AUCTION_FEE from a given Bidder.
   * We dispatch an IS_FEE action that we will later use to verify payment.
   */
  @method depositFee(amount: UInt64, nullifier: Field) {
    // anyone can deposit ...
    let senderUpdate = AccountUpdate.create(this.sender);
    senderUpdate.requireSignature();
    senderUpdate.send({
      to: this,
      amount
    });

    let total = this.auctionPot.getAndRequireEquals();
    total = total.add(amount);
    this.auctionPot.set(total);

    // dispatch an action thta we will use later to prove the deposit
    this.reducer.dispatch({
      type: IS_FEE,
      nullifier: nullifier,
      deposit: amount,
      bid: Field(0),
      winner: Field(0),
    })
  }


  /**
   * Makes the bid, asscoiated to a given Bidder's nullifier.
   * Also verifies that the bidder has really paid the deposit fee,
   * and thst it belongs to the biddersCollection and the bidsMap.
   * We dispatch a IS_BID Action, but we are not using it right now.
   */
  @method makeBid(
    bid: Field, 
    nullifier: Field,
    biddersRoot: Field,
    biddersWitness: MTH16Witness,
    bidsRoot: Field,
    bidsWitness: MerkleMapWitness
  ) {
    // assert this bidder has deposited its FEE
    const paid = this.hasDeposit(nullifier);
    paid.assertEquals(Field(1));

    let biddersCommitment = this.biddersCommitment.getAndRequireEquals();
    this.assertIsValidBidder(nullifier, biddersRoot, biddersWitness);
    this.biddersCommitment.set(biddersRoot);
    
    let bidsCommitment = this.bidsCommitment.getAndRequireEquals();
    this.assertIsValidBid(bid, nullifier, bidsRoot, bidsWitness);
    this.bidsCommitment.set(bidsRoot);

    let biddersCount = this.biddersCount.getAndRequireEquals();
    let counter = biddersCount.add(1);
    this.biddersCount.set(counter);

    // dispatch an action that we will use later to prove the Bid
    this.reducer.dispatch({
      type: IS_BID,
      nullifier: nullifier,
      bid: bid,
      deposit: UInt64.from(0),
      winner: Field(0),
    })
  }


  /**
   * Sets the winner and closes the auction.
   * First check that the winner is in the biddersCollection.
   */
  @method setWinner(
    nullifier: Field, 
    bid: Field,
    biddersRoot: Field,
    biddersWitness: MTH16Witness,
    receiver: PublicKey,
    amount: UInt64
  ) {
    let biddersCommitment = this.biddersCommitment.getAndRequireEquals();
    this.assertIsValidBidder(nullifier, biddersRoot, biddersWitness);
    biddersRoot.assertEquals(biddersCommitment);

    // mark the winner and bid
    let winnerNullifier = this.winnerNullifier.getAndRequireEquals();
    this.winnerNullifier.set(nullifier);
    let leastUniqueBid = this.leastUniqueBid.getAndRequireEquals()
    this.leastUniqueBid.set(bid);

    // pay the winner !
    let senderUpdate = AccountUpdate.create(this.sender);
    senderUpdate.requireSignature();
    senderUpdate.send({ to: receiver, amount });
  }


  /**
   * Reduce the actions of type IS_FEE to check if the user with the
   * given nullifier has really payed the AUCTION_FEE. 
   * We will use this when proving that he has bidded.
   */
  hasDeposit(nullifier: Field): Field {
    // compute the new counter and hash from pending actions
    let initialActionState = Reducer.initialActionState;
    let actions = this.reducer.getActions({
      fromActionState: initialActionState,
    });

    // reduced {state, actionState }
    let reduced = this.reducer.reduce(
      actions,    // actions array to reduce
      Field,      // the state type

      // how to apply the action
      function(state: Field, action: AuctionAction) {
        const assertedFee = action.type.equals(IS_FEE);
        const assertedNullifier = action.nullifier.equals(nullifier);
        const assertedDeposit = action.deposit.equals(UInt64.from(AUCTION_FEE));
        state = Provable.if(assertedFee.and(assertedNullifier.and(assertedDeposit)), 
          Field(1), // has payed the AUCTION_FEE 
          state
        );
        return state;
      },

      // initial state and actions point
      { state: Field(0), actionState: initialActionState } 
    );

    return reduced.state;  // 1: Payed, 0: Notpayed
  }

  /**
   * Asserts that the bidder is in the biddersCollection MerkleTree
   */
  assertIsValidBidder(
    nullifier: Field, 
    root: Field, witness: MTH16Witness
  ) 
  {
    let recalculatedRoot = witness.calculateRoot(nullifier);
    recalculatedRoot.assertEquals(root, "Invalid bidder root");  
  }

  /** 
   * Asserts that the bid is in the bidsMap MerkleMap 
   */
  assertIsValidBid(
    bid: Field, nullifier: Field, 
    root: Field, witness: MerkleMapWitness
  ) {
    const [witnessRoot, witnessKey] = witness.computeRootAndKey(bid);
    witnessKey.assertEquals(nullifier, "Invalid bid nullifier");
    root.assertEquals(witnessRoot, "Invalid bid root") ;
  }
}