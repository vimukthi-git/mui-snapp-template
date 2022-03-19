import { Field, SmartContract, state, State, method, UInt64, Mina, Party, PrivateKey, PublicKey, isReady, CircuitValue, Int64, prop, arrayProp } from 'snarkyjs';

export { deploy, update, getSnappState };

await isReady;

export class RequiredProof extends CircuitValue {
  @prop upperBound: Int64;
  @prop lowerBound: Int64;

  constructor(
    upperBound: Int64,
    lowerBound: Int64
  ) {
    super();
    this.upperBound = upperBound;
    this.lowerBound = lowerBound;
  }
}

// Increase this constant to see the error in the `update` function 
// 
// "Encountered an error while evaluating the checked computation:
//  ("Error: array_get_exn: index=8, length=10")
// 
//  Label stack trace:
// "
const MAX_REQUIRED_PROOFS = 4;
export class RequiredProofs extends CircuitValue {
  @arrayProp(RequiredProof, MAX_REQUIRED_PROOFS)
  requiredProofs: Array<RequiredProof>;

  constructor(requiredProofs: Array<RequiredProof>) {
    super();
    this.requiredProofs = requiredProofs;
  }
}

/**
 * Basic Example
 * See https://docs.minaprotocol.com/snapps for more info.
 *
 * The Add contract initializes the state variable 'num' to be a Field(1) value by default when deployed.
 * When the 'update' method is called, the Add contract adds Field(2) to its 'num' contract state.
 */
export default class Add extends SmartContract {
  @state(RequiredProofs) proofs = State<RequiredProofs>();

  // initialization
  deploy(initialBalance: UInt64, num: RequiredProofs) {
    super.deploy();
    this.balance.addInPlace(initialBalance);
    this.proofs.set(num);
  }

  @method async update() {
    const currentState = await this.proofs.get();
    console.log(currentState);
  }
}

// setup
const Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);
const account1 = Local.testAccounts[0].privateKey;
const account2 = Local.testAccounts[1].privateKey;

let isDeploying = null as null | {
  update(): Promise<void>;
  getSnappState(): Promise<{
    num: Field;
  }>;
};

async function deploy() {
  if (isDeploying) return isDeploying;
  const snappPrivkey = PrivateKey.random();
  let snappAddress = snappPrivkey.toPublicKey();
  let snappInterface = {
    update() {
      return update(snappAddress);
    },
    getSnappState() {
      return getSnappState(snappAddress);
    },
  };
  isDeploying = snappInterface;

  let snapp = new Add(
    snappAddress,
  );
  let tx = Mina.transaction(account1, async () => {
    console.log('Deploying Add...');
    const initialBalance = UInt64.fromNumber(1000000);
    const p = await Party.createSigned(account2);
    p.balance.subInPlace(initialBalance);
    snapp.deploy(initialBalance, new RequiredProofs([new RequiredProof(
      new Int64(new Field(100000)),
      new Int64(new Field(3000)))]));
  });
  await tx.send().wait();

  isDeploying = null;
  return snappInterface;
}

async function update(snappAddress: PublicKey) {
  let snapp = new Add(snappAddress);
  let tx = Mina.transaction(account1, async () => {
    await snapp.update();
  });
  try {
    await tx.send().wait();
  } catch (err) {
    console.log('Update rejected!', err);
  }
}

async function getSnappState(snappAddress: PublicKey) {
  let snappState = (await Mina.getAccount(snappAddress)).snapp.appState;
  return {
    num: snappState[0]
  };
}

