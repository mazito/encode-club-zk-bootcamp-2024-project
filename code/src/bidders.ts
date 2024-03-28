import { Field, PrivateKey, PublicKey, Poseidon } from "o1js";
import { randomBytes } from "crypto";

export { Bidder, nullifyAccount, randomBid };

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


function randomBid(): Field {
  const bits = 256;
  const bytes = Math.ceil(bits / 8);
  const buffer = randomBytes(bytes);
  // Convert the buffer to a hexadecimal string
  let hex = '0x' + buffer.toString('hex');
  // Convert the hexadecimal string to a BigInt
  let bigInt = BigInt(hex);
  // Ensure the BigInt size matches the specified bit length
  const maxBigIntSize = BigInt(2) ** BigInt(bits);
  bigInt = bigInt % maxBigIntSize;
  return Field(bigInt);
}


