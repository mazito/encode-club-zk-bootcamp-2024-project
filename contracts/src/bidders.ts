import { Field, PrivateKey, PublicKey, Poseidon } from 'o1js';

export { Bidder, nullifyAccount };

const SECRET = "33201100009856408";

interface Bidder {
  privateKey: PrivateKey;
  publicKey: PublicKey;
  nullifier: Field
}

function nullifyAccount(account: {
  privateKey: PrivateKey,
  publicKey: PublicKey
}): Bidder {
  return {
    privateKey: account.privateKey,
    publicKey: account.publicKey,
    nullifier: Poseidon.hash(
      [Field(SECRET)]
      .concat(account.privateKey.toFields())
    )
  }
}
