import { Field, ZkProgram, SelfProof, Struct } from "o1js";
import { Provable } from "o1js";

export { Winner, AuctionRollup, MAX_FIELD }

// const MAX_FIELD = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
const MAX_FIELD = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';

class Winner extends Struct({
  nullifier: Field,
  bid: Field
}) {

  static zero(): Winner {
    return {
      nullifier: Field(0),
      bid: Field(MAX_FIELD) 
    }
  } 

  static selected(current: Winner, challenger: Winner): Winner {
    let isLessThanCurrent = challenger.bid.lessThan(current.bid);
    let newBid = Provable.if(isLessThanCurrent, 
      challenger.bid, 
      current.bid
    );
    let newNullifier = Provable.if(isLessThanCurrent, 
      challenger.nullifier, 
      current.nullifier
    );
    return {
      nullifier: newNullifier,
      bid: newBid
    }
  }  
}


const AuctionRollup = ZkProgram({
  name: "auction-rollup",
  publicInput: Winner,

  methods: {
    initial: {
      privateInputs: [],

      method(publicInput: Winner) {
        publicInput.nullifier.assertEquals(Field(0));
        publicInput.bid.assertEquals(Field(MAX_FIELD));
      },
    },

    step: {
      privateInputs: [SelfProof, Winner],
      method(
        publicInput: Winner, 
        previousProof: SelfProof<Winner, void>,
        challenger: Winner
      ) {
        previousProof.verify();
        publicInput.bid.assertGreaterThan(Field(0));
        publicInput.nullifier.assertNotEquals(Field(0));

        // we need some other assertions here
        // assertIsValidBidder
        // assertIsValidBid  

        let calculatedWinner = Winner.selected(publicInput, challenger);
        calculatedWinner.bid.assertEquals(publicInput.bid);
        calculatedWinner.nullifier.assertEquals(publicInput.nullifier);
      },
    },
  },  
});
