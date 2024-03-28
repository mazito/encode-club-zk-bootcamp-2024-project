import { Field, ZkProgram, SelfProof, Struct } from "o1js";
import { Provable } from "o1js";

export { Winner, AuctionRollup, MAX_FIELD }

class Winner extends Struct({
  nullifier: Field,
  bid: Field
}) {}

const MAX_FIELD = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';

const AuctionRollup = ZkProgram({
  name: "auction-rollup",
  publicInput: Winner,
  publicOutput: Winner,

  methods: {
    initial: {
      privateInputs: [],

      method(publicInput: Winner) {
        publicInput.nullifier.assertEquals(Field(0));
        publicInput.bid.assertEquals(Field(MAX_FIELD));
        return { 
          nullifier: publicInput.nullifier,
          bid: publicInput.bid
        };
      },
    },

    step: {
      privateInputs: [SelfProof, Winner],
      method(
        publicInput: Winner, 
        previousProof: SelfProof<Winner, Winner>,
        challenger: Winner
      ) {
        previousProof.verify();
        publicInput.bid.assertGreaterThan(Field(0));
        publicInput.nullifier.assertNotEquals(Field(0));

        // we need some other assertions here
        // assertIsValidBidder
        // assertIsValidBid  

        let currentWinner = publicInput;
        let isLessThanWinner = challenger.bid.lessThan(currentWinner.bid);
        let newBid = Provable.if(isLessThanWinner, 
          challenger.bid, 
          currentWinner.bid
        );
        let newNullifier = Provable.if(isLessThanWinner, 
          challenger.nullifier, 
          currentWinner.nullifier
        );
        return {
          nullifier: newNullifier,
          bid: newBid
        }
      },
    },
  },  
});