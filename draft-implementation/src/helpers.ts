import { ScpBallot } from './types';
import { sha256 } from './neighbors';
import ProtocolState from './ProtocolState';
import * as _ from 'lodash';
import { blockingThreshold, quorumThreshold } from './validateSlices';

const maxVal = 100000;

export const isBallotLower = (a: ScpBallot, b: ScpBallot) => {
    return a.counter < b.counter || ((a.counter === b.counter) && a.value.length < b.value.length);
}

export const hash = (x: any) => sha256(JSON.stringify(x));
export const hashBallot = (b: ScpBallot) => hash({ ...b, values: b.value.sort() })
export const hashBallotValue = (b: ScpBallot | null) => hash(b ? b.value.sort() : null)

const armTimer = (state: ProtocolState, increaseFunc: () => void) => {
    if (state.prepareTimeoutCounter < state.prepare.ballot.counter) {
        state.log('Arming timer for current counter ', state.prepare.ballot.counter);
        if (state.prepareTimeout) clearTimeout(state.prepareTimeout);
        state.prepareTimeoutCounter = state.prepare.ballot.counter;
        state.prepareTimeout = setTimeout(() => {
            state.log('Timer fired for counter ', state.prepare.ballot.counter);
            // FIXME: send message again
            increaseFunc();
        }, (state.prepare.ballot.counter + 1) * 1000)
    }
}

export const checkQuorumForCounter = (state: ProtocolState, increaseFunc: () => void) => {
    const votersFormPrepare = state.prepareStorage.getAllValuesAsArary()
        .filter(p => p.ballot.counter && (p.ballot.counter >= state.prepare.ballot.counter))
        .map(p => p.node);
    const votersFromCommit = state.commitStorage.getAllValuesAsArary()
        .filter(p => p.ballot.counter && (p.ballot.counter >= state.prepare.ballot.counter))
        .map(p => p.node);
    const votersFromExternalize = state.externalizeStorage.getAllValuesAsArary().map(p => p.node);
    const votersWithCounterEqualOrAbove = _.uniq([...votersFormPrepare, ...votersFromCommit, ...votersFromExternalize]);
    const isQuorum = quorumThreshold(state.nodeSliceMap, votersWithCounterEqualOrAbove, state.options.self);
    if (isQuorum) armTimer(state, increaseFunc);
}

export const checkBlockingSetForCounter = (state: ProtocolState, setFunc: (value: number) => void) => {
    const preparesWithCounterAbove = state.prepareStorage.getAllValuesAsArary()
        .filter(p => p.ballot.counter > state.prepare.ballot.counter);
    const commitsWithCounterAbove = state.commitStorage.getAllValuesAsArary()
        .filter(p => p.ballot.counter > state.prepare.ballot.counter);
    const externalizesWithCounterAbove = state.externalizeStorage.getAllValuesAsArary(); // externalize implicitly has counter Infinity
    const nodesWithCounterAbove = _.uniq([...preparesWithCounterAbove, ...commitsWithCounterAbove, ...externalizesWithCounterAbove].map(x => x.node));
    const isBlockingSet = blockingThreshold(state.options.slices, nodesWithCounterAbove);
    if (isBlockingSet) {
        const counters = [...preparesWithCounterAbove.map(p => p.ballot.counter), ...commitsWithCounterAbove.map(p => p.ballot.counter)];
        const lowestCounter = Math.min(...counters, maxVal);
        state.log('Found a blocking set with lowest counter ', lowestCounter)
        if (state.prepareTimeout) clearTimeout(state.prepareTimeout);
        setFunc(lowestCounter);
        // TODO: Rework this step, this might be inefficient
        let findsAnotherBlockingSet = false;
        if (lowestCounter !== maxVal) {
            findsAnotherBlockingSet = checkBlockingSetForCounter(state, setFunc);
        }
        if (!findsAnotherBlockingSet) {
            checkQuorumForCounter(state, () => state.prepare.ballot.counter++);
        }
        return true;
    }
    return false;
}