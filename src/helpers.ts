import { ScpBallot } from './types';
import { sha256 } from './neighbors';
import * as _ from 'lodash';

export const infinityCounter = 100000;

export const isBallotLower = (a: ScpBallot, b: ScpBallot) => {
  return a.counter < b.counter || (a.counter === b.counter && a.value.length < b.value.length);
};

export const isBallotLowerOrEqual = (a: ScpBallot, b: ScpBallot) => {
  return isBallotLower(a, b) || (a.counter === b.counter && a.value.length === b.value.length);
};

export const hash = (x: any) => sha256(JSON.stringify(x));
export const hashBallot = (b: ScpBallot) => hash({ counter: b.counter, value: b.value.sort() });
export const hashBallotValue = (b: ScpBallot | null) => hash(b ? b.value.sort() : null);
