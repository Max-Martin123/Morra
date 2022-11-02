import React from "react";
import AppViews from "./views/AppViews";
import DeployerViews from "./views/DeployerViews";
import AttacherViews from "./views/AttacherViews";
import { renderDOM, renderView } from "./views/render";
import "./index.css";
import * as backend from "./build/index.main.mjs";
import { loadStdlib } from "@reach-sh/stdlib";
const reach = loadStdlib(process.env);

import { ALGO_MyAlgoConnect as MyAlgoConnect } from "@reach-sh/stdlib";
reach.setWalletFallback(
  reach.walletFallback({
    providerEnv: "TestNet",
    MyAlgoConnect,
  })
);

const intToOutcome = ["Bob wins!", "Draw!", "Alice wins!"];
const { standardUnit } = reach;
const defaults = { defaultFundAmt: "10", defaultWager: "3", standardUnit };

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = { view: "ConnectAccount", ...defaults };
  }
  async componentDidMount() {
    const acc = await reach.getDefaultAccount();
    const balAtomic = await reach.balanceOf(acc);
    const bal = reach.formatCurrency(balAtomic, 4);
    this.setState({ acc, bal });
    if (await reach.canFundFromFaucet()) {
      this.setState({ view: "FundAccount" });
    } else {
      this.setState({ view: "DeployerOrAttacher" });
    }
  }
  async fundAccount(fundAmount) {
    await reach.fundFromFaucet(this.state.acc, reach.parseCurrency(fundAmount));
    this.setState({ view: "DeployerOrAttacher" });
  }
  async skipFundAccount() {
    this.setState({ view: "DeployerOrAttacher" });
  }
  selectAttacher() {
    this.setState({ view: "Wrapper", ContentView: Attacher });
  }
  selectDeployer() {
    this.setState({ view: "Wrapper", ContentView: Deployer });
  }
  render() {
    return renderView(this, AppViews);
  }
}

class Player extends React.Component {
  random() {
    return reach.hasRandom.random();
  }
  async getHand() {
    // Fun([], UInt)
    const hand = await new Promise((resolveHandP) => {
      this.setState({ view: "GetHand", playable: true, resolveHandP });
    });
    this.setState({ view: "GetSum", hand });
    return hand;
  }
  seeOutcome(i) {
    this.setState({ view: "Done", outcome: intToOutcome[i] });
    console.log(intToOutcome[i]);
  }
  seeWinner(i) {
    console.log(`The winner is number is ${i}`);
  }
  informTimeout() {
    this.setState({ view: "Timeout" });
  }
  playHand(hand) {
    this.state.resolveHandP(hand);
  }
  async getSum() {
    // Fun([], UInt)
    const sum = await new Promise((resolveHandP) => {
      this.setState({ view: "GetSum", playable: true, resolveHandP });
    });
    this.setState({ view: "WaitingForResults" });
    return sum;
  }
  seeOutcome(i) {
    this.setState({ view: "Done", outcome: intToOutcome[i] });
  }
  informTimeout() {
    this.setState({ view: "Timeout" });
  }
  playSum(sum) {
    this.state.resolveHandP(sum);
  }
}

class Deployer extends Player {
  constructor(props) {
    super(props);
    this.state = { view: "SetWager" };
  }
  setWager(wager) {
    this.setState({ view: "Deploy", wager });
  }
  async deploy() {
    const ctc = this.props.acc.contract(backend);
    this.setState({ view: "Deploying", ctc });
    this.wager = reach.parseCurrency(this.state.wager); // UInt
    this.deadline = { ETH: 10000, ALGO: 100000, CFX: 1000000 }[reach.connector]; // UInt
    backend.Alice(ctc, this);
    const ctcInfoStr = JSON.stringify(await ctc.getInfo(), null, 2);
    this.setState({ view: "WaitingForAttacher", ctcInfoStr });
  }
  render() {
    return renderView(this, DeployerViews);
  }
}
class Attacher extends Player {
  constructor(props) {
    super(props);
    this.state = { view: "Attach" };
  }
  attach(ctcInfoStr) {
    const ctc = this.props.acc.contract(backend, JSON.parse(ctcInfoStr));
    this.setState({ view: "Attaching" });
    backend.Bob(ctc, this);
  }
  async acceptWager(wagerAtomic) {
    // Fun([UInt], Null)
    const wager = reach.formatCurrency(wagerAtomic, 4);
    return await new Promise((resolveAcceptedP) => {
      this.setState({ view: "AcceptTerms", wager, resolveAcceptedP });
    });
  }
  termsAccepted() {
    this.state.resolveAcceptedP();
    this.setState({ view: "WaitingForTurn" });
  }
  render() {
    return renderView(this, AttacherViews);
  }
}

renderDOM(<App />);
