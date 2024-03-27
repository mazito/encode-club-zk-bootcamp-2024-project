
# ZK Reverse Bidding Auction 

**Encode Club ZK - Bootcamp 2024** 

Group-2 Team:

- Mike Ghen
- Luis Sierra
- Mario Zito

### Proposal

We plan to implement a **ZK Reverse Bidding protocol**.

What is **Reverse Bidding** ? An Auction protocol where the lower unique offer wins the bidding.

The idea is based on this: https://github.com/organik-inc/reverse-bidding

> *OK Vault is the first Reverse Bidding Auction (RBA) Generator. A RBA is a novel Auction Protocol, natively retail-friendly and whale-proof. In order to win this Auction you have to bid the LEAST UNIQUE Amount. The Pool get's paid out first to the Winner and if the Prize is smaller than the Pool, the creator will receive the earnings of the Auction.*

### Features

- Bidders have to pay a fix fee to bid.
- All received fees are accumulated and conform the "auction pot".
- The bidder will remain anonymous all over the auction process.
- His/her bid is encrypted and hidden to the other bidders.
- Bidders have to demonstrate that they have paid to be able to bid.
- The auction has start and end date and times, and set the "valid auction time span".
- Bids can only be received during the valid auction time span.
- On auction end, all bids are processed and the winner is selected.
- The winner gets  a fixed share of the collected auction pot.
- The auctioneer keeps the rest of the pot.

### Use cases

Although it may seem unusual, reverse auctions are frequently used in real-world scenarios.

1. **Government Contracts**: Government agencies often conduct auctions or competitive bidding processes to procure goods or services at the best possible price from qualified providers. For example, a city government might hold an auction to select a construction company to build a new bridge.
2. **Online Marketplaces**: E-commerce platforms such as eBay or Amazon often host auctions where sellers compete to offer the lowest price for products. Buyers can bid on items, and the seller with the lowest bid typically wins the auction.
3. **Supplier Negotiations**: Businesses looking to source raw materials or components for manufacturing might hold bidding events among their suppliers to secure the most favorable pricing. For instance, an automobile manufacturer might auction off a contract for steel supply to multiple steel producers.
4. **Freelance Services**: Platforms like Upwork or Freelancer allow businesses to post projects and receive bids from freelancers or service providers. The buyer can then select the bid that offers the best combination of price and quality for their needs.

In all of these examples, the goal is for the buyer to obtain the desired goods or services "at the most competitive price (the least unique price)", which is the result of the reverse bidding auction, by inviting providers to bid against each other.

### Why Zero Knowledge ?

The main reasons we want to use ZK is:

- Keep bidders anonymous
- Keep bids secret all along the bidding process
- Prove a correct winner selection process

We will be using for:

- Proof that a bidder has paid his/her fee
- Proof of inclusion of a bidder in the bidders set
- Proof of execution of the winner selection process
- Proof that he is the winner to collect the prize

### Limitations

Currently the process is "semi private" as the bid amount must be encrypted on the "server side" using a shared encryption key. 

So the bid will not be visible to other bidders but will be visible to the server process running the auction. BUT the bidder will be still unknown to the server process.

### Data model

**bidderNullifier**

Each **bidder** is uniquely identified by a **nullifier**, which is created by using his/her private key:

- `bidderNullifier` = `hash(bidderPrivatekey)`

Because the private key is not known, it is impossible to calculate or predict it from the nullifier itself.

**BiddersCollection**:

This is a Merkle Tree of all bidders. It is used to traverse the set of bidders, and to prove that it is a valid bidder.

 Each Leaf in the tree has:

- `index`: the order in which this bidder was added.
- `value`: the bidder nullifier.

A bidder is only added to the collection when meeting two conditions:

- Must provide proof that he has paid.
- Must provide proof that he submitted a bid.

**BidsMap**

This is a Merkle Map of all collected bids. It is used to store each bid, and get the bid for a given bidder when recursively processing all the bids for selecting the winner.

Each Leaf in the Map has:

- `key`: the bidder nullifier.

- `value` : the encrypted bid amount created as encrypted(bidAmount).

Note: _because we are using a Map, it is not possible for a bidder to provide more than one bid, as the nullifier created by using his/her private key will be unique_.

A bidder is only added to this Map when meeting two conditions:

- Must provide proof that he has paid the fee.
- Must verify that the bidding amount is valid (not zero for example).

**PaymentProofsMap**

This is a Merkle Map of all payment proofs. Its is used to store the proof that a given bidder has paid his fee, and to get the proof when validating if the bidder can send the bid.

Each Leaf in the Map has:

- `key`: the bidder nullifier.

- `value` : the "proof" of payment.

Note: _because we are using a Map, it is not possible for a bidder to provide more than one proof, as the nullifier created by using his/her private key will be unique_.

A bidder is only added to this Map when meeting a condition:

- Verify that he has paid.

### Steps

**1. Create the auction**

We need a MINA SmartContract with the following state fields:

- biddersCommitment
- biddersCount
- auctionPot
- winnerNullifier
- leastUniqueBid
- starstUTC
- endsUTC

Other params or constants:

- bidingFee

**2. Start the auction**

We start the auction by:

- Creating the ReverseAuction smart contract and initializing it.
- Creating the MerkleMap of bids and initializing it.
- Creating the MerkleMap of payment proofs and initializing it.
- Creating a MerkleTree of bidders and initializing it.

**3. Collect bids**

When the auction is open a bidder will do:

- Create his nullifier, used as his unique id.

- Pay the fee, obtaining the proof of payment. This will add his/her nullifier to the PaymentProofsMap.
- Send the bid, by signing the bid with his private key. This will add the bid to the BidsMap and his/her nullifier to the BiddersCollection.

**4. End the auction**

When the auction is ended we will need to "seal" the auction so that no more bids can be received.

**5. Select winner**

For selecting the winner we need to:

- Traverse the `BiddersCollection`, getting each `bid` from the `BidsMap`.
- Decrypt the `bid` and accumulate it on the `auctionPot`.
- Verify if this `bid` is lowest that the existent `leastUniqueBid` 
- Verify if this `bid` is unique
- If the previous conditions are met, set the bidder as the `winnerNullifier` and the bid as the `leastUniqueBid`

At the end of the process we get the winner and the least unique bid value.

We need to **publish the `winnerNullifier`** so that the owner of that nullifier can see that he/she has won the auction.

**6. Pay winner**

The winner can finally collect the price, by proving that he is the right owner of the `winnerNullifier`.

