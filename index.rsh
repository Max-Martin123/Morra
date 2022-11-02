"reach 0.1";
const Player = {
  ...hasRandom,
  getHand: Fun([], UInt),
  getSum: Fun([UInt], UInt),
  seeWinner: Fun([UInt], Null),
  seeOutcome: Fun([UInt], Null),
  informTimeout: Fun([], Null),
};

const [isOutcome, B_WINS, DRAW, A_WINS] = makeEnum(3);
const Alice = { ...Player, wager: UInt };
const Bob = { ...Player, acceptWager: Fun([UInt], Null) };
const DEADLINE = 30;
const winner = (HandAlice, HandBob, sumAlice, sumBob) => {
  if (sumAlice == sumBob) {
    const myoutcome = DRAW;
    return myoutcome;
  } else {
    if (HandAlice + HandBob == sumAlice) {
      const myoutcome = A_WINS;
      return myoutcome;
    } else {
      if (HandAlice + HandBob == sumBob) {
        const myoutcome = B_WINS;
        return myoutcome;
      } else {
        const myoutcome = DRAW;
        return myoutcome;
      }
    }
  }
};

export const main = Reach.App(
  {},
  [Participant("Alice", Alice), Participant("Bob", Bob)],
  (A, B) => {
    const informTimeout = () => {
      each([A, B], () => {
        interact.informTimeout();
      });
    };
    A.only(() => {
      const wager = declassify(interact.wager);
    });
    A.publish(wager).pay(wager);
    commit();

    B.only(() => {
      interact.acceptWager(wager);
    });
    B.pay(wager).timeout(relativeTime(DEADLINE), () =>
      closeTo(A, informTimeout)
    );

    var outcome = DRAW;
    invariant(balance() == 2 * wager && isOutcome(outcome));

    while (outcome == DRAW) {
      commit();
      A.only(() => {
        const _HandAlice = interact.getHand();
        const _sumAlice = interact.getSum(_HandAlice);
        const [_commitA, _saltA] = makeCommitment(interact, _HandAlice);
        const commitA = declassify(_commitA);
        const [_guessCommitA, _guessSaltA] = makeCommitment(
          interact,
          _sumAlice
        );
        const guessCommitA = declassify(_guessCommitA);
      });

      A.publish(commitA).timeout(relativeTime(DEADLINE), () =>
        closeTo(B, informTimeout)
      );
      commit();

      unknowable(B, A(_HandAlice, _saltA));
      unknowable(B, A(_sumAlice, _guessSaltA));

      A.publish(guessCommitA).timeout(relativeTime(DEADLINE), () =>
        closeTo(B, informTimeout)
      );
      commit();

      B.only(() => {
        const _HandBob = interact.getHand();
        const _sumBob = interact.getSum(_HandBob);
        const HandBob = declassify(_HandBob);
        const sumBob = declassify(_sumBob);
      });

      B.publish(HandBob).timeout(relativeTime(DEADLINE), () =>
        closeTo(A, informTimeout)
      );
      commit();
      B.publish(sumBob).timeout(relativeTime(DEADLINE), () =>
        closeTo(A, informTimeout)
      );
      commit();

      A.only(() => {
        const [saltA, HandAlice] = declassify([_saltA, _HandAlice]);
        const [guessSaltA, sumAlice] = declassify([_guessSaltA, _sumAlice]);
      });
      A.publish(saltA, HandAlice).timeout(relativeTime(DEADLINE), () =>
        closeTo(B, informTimeout)
      );
      checkCommitment(commitA, saltA, HandAlice);
      commit();

      A.publish(guessSaltA, sumAlice).timeout(relativeTime(DEADLINE), () =>
        closeTo(B, informTimeout)
      );
      checkCommitment(guessCommitA, guessSaltA, sumAlice);

      commit();

      A.only(() => {
        const WinSum = HandAlice + HandBob;
        interact.seeWinner(WinSum);
      });

      A.publish(WinSum).timeout(relativeTime(DEADLINE), () =>
        closeTo(A, informTimeout)
      );

      outcome = winner(HandAlice, HandBob, sumAlice, sumBob);
      continue;
    }

    assert(outcome == A_WINS || outcome == B_WINS);
    transfer(2 * wager).to(outcome == A_WINS ? A : B);
    commit();
    each([A, B], () => {
      interact.seeOutcome(outcome);
    });
    exit();
  }
);
