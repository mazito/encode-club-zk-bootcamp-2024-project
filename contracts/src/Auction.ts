import {
  Field,
  AccountUpdate,
  SmartContract,
  state,
  State,
  method,
  UInt64,
  Struct,
  Reducer,
  Provable
} from 'o1js';

export { AUCTION_FEE };

const AUCTION_FEE = 3; // Fee is 3 MINA per Bid

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
    this.biddersCommitment.set(Field(0));
    this.biddersCount.set(UInt64.from(0));
    this.auctionPot.set(UInt64.from(0));
    this.winnerNullifier.set(Field(0));
    this.leastUniqueBid.set(Field(0));
    this.startsUTC.set(UInt64.from(0));
    this.endsUTC.set(UInt64.from(0));
  }


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
        const assertedNullifier = action.nullifier.equals(nullifier);
        const assertedDeposit = action.deposit.equals(UInt64.from(AUCTION_FEE));
        state = Provable.if(action.type.equals(IS_FEE), 
          Provable.if(assertedNullifier.and(assertedDeposit), 
            Field(1), // has payed the AUCTION_FEE 
            Field(0) // has NOT payed
          ),
          Field(0) // is not FEE action type
        );
        return state;
      },

      // initial state and actions point
      { state: Field(0), actionState: initialActionState } 
    );

    return reduced.state;  // 1: Payed, 0: Notpayed
  }
}