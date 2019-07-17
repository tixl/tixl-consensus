import { ScpSlices, Value, PublicKey, MessageEnvelope } from './types';
import { getNeighbors, getPriority } from './neighbors';
import * as _ from 'lodash';
import ProtocolState from './ProtocolState';
import { commit } from './phases/commit';
import { prepare } from './phases/prepare';
import { nominate } from './phases/nominate';
import { externalize } from './phases/externalize';
import { quorumThreshold, blockingThreshold } from './validateSlices';

export type BroadcastFunction = (envelope: MessageEnvelope) => void;

export interface ProtocolOptions {
    self: PublicKey
    slices: ScpSlices
    suggestedValues: Value[],
    slot: number;
}

export type checkQuorumForCounterFunction = (increaseFunc: () => void) => void;
export type checkBlockingSetForCounterFunction = (setFunc: (value: number) => void) => void;

export type Phase = 'NOMINATE' | 'PREPARE' | 'COMMIT' | 'EXTERNALIZE';

const baseTimeoutValue = 1000;
const timeoutValue = 1000;
const maxVal = 100000;

export const protocol = (broadcast: BroadcastFunction, options: ProtocolOptions) => {
    const { self, slices, suggestedValues, slot } = options;
    const log = (...args: any[]) => console.log(`${self}: `, ...args);
    // const log = (...args: any[]) => { return args };

    const armTimer = (increaseFunc: () => void) => {
        if (state.prepareTimeoutCounter < state.prepare.ballot.counter) {
            log('Arming timer for current counter ', state.prepare.ballot.counter);
            if (state.prepareTimeout) clearTimeout(state.prepareTimeout);
            state.prepareTimeoutCounter = state.prepare.ballot.counter;
            state.prepareTimeout = setTimeout(() => {
                increaseFunc();
            }, (state.prepare.ballot.counter + 1) * 1000)
        }
    }

    const checkQuorumForCounter = (increaseFunc: () => void) => {
        const votersFormPrepare = state.prepareStorage.getAllValuesAsArary()
            .filter(p => p.ballot.counter && (p.ballot.counter >= state.prepare.ballot.counter))
            .map(p => p.node);
        const votersFromCommit = state.commitStorage.getAllValuesAsArary()
            .filter(p => p.ballot.counter && (p.ballot.counter >= state.prepare.ballot.counter))
            .map(p => p.node);
        const votersFromExternalize = state.externalizeStorage.getAllValuesAsArary().map(p => p.node);
        const votersWithCounterEqualOrAbove = _.uniq([...votersFormPrepare, ...votersFromCommit, ...votersFromExternalize]);
        const isQuorum = quorumThreshold(state.nodeSliceMap, votersWithCounterEqualOrAbove, self);
        if (isQuorum) armTimer(increaseFunc);
    }

    const checkBlockingSetForCounter = (setFunc: (value: number) => void) => {
        const preparesWithCounterAbove = state.prepareStorage.getAllValuesAsArary()
            .filter(p => p.ballot.counter > state.prepare.ballot.counter);
        const commitsWithCounterAbove = state.commitStorage.getAllValuesAsArary()
            .filter(p => p.ballot.counter > state.prepare.ballot.counter);
        const externalizesWithCounterAbove = state.externalizeStorage.getAllValuesAsArary(); // externalize implicitly has counter Infinity
        const nodesWithCounterAbove = _.uniq([...preparesWithCounterAbove, ...commitsWithCounterAbove, ...externalizesWithCounterAbove].map(x => x.node));
        const isBlockingSet = blockingThreshold(slices, nodesWithCounterAbove);
        if (isBlockingSet) {
            const counters = [...preparesWithCounterAbove.map(p => p.ballot.counter), ...commitsWithCounterAbove.map(p => p.ballot.counter)];
            const lowestCounter = Math.min(...counters, maxVal);
            log('Found a blocking set with lowest counter ', lowestCounter)
            if (state.prepareTimeout) clearTimeout(state.prepareTimeout);
            setFunc(lowestCounter);
            // TODO: Rework this step, this might be inefficient
            let findsAnotherBlockingSet = false;
            if (lowestCounter !== maxVal) {
                findsAnotherBlockingSet = checkBlockingSetForCounter(setFunc);
            }
            if (!findsAnotherBlockingSet) {
                checkQuorumForCounter(() => state.prepare.ballot.counter++);
            }
            return true;
        }
        return false;
    }

    const state = new ProtocolState();
    state.nodeSliceMap.set(self, slices);
    const { receiveExternalize, enterExternalizePhase } = externalize(state, options, broadcast, log);
    const { receiveCommit, enterCommitPhase } = commit(state, options, broadcast, log, enterExternalizePhase, checkQuorumForCounter, checkBlockingSetForCounter);
    const { receivePrepare, enterPreparePhase } = prepare(state, options, broadcast, log, enterCommitPhase, checkQuorumForCounter, checkBlockingSetForCounter);
    const { receiveNominate, addToVotes } = nominate(state, options, broadcast, log, enterPreparePhase)


    const receive = (envelope: MessageEnvelope) => {
        // TODO: Find a better way to set the slices
        state.nodeSliceMap.set(envelope.sender, envelope.slices);
        switch (envelope.type) {
            case "ScpNominate": receiveNominate(envelope); break;
            case "ScpPrepare": receivePrepare(envelope); break;
            case "ScpCommit": receiveCommit(envelope); break;
            case "ScpExternalize": receiveExternalize(envelope); break;
            default: throw new Error('unknown message type')
        }
    }

    const determinePriorityNode = () => {
        const neighbors = [self, ...getNeighbors(slot, state.nominationRound, slices)];
        const priorities = new Map<PublicKey, BigInt>();
        neighbors.forEach(v => priorities.set(v, getPriority(slot, state.nominationRound, v)));
        log({ neighbors });

        const maxPriorityNeighbor: PublicKey = neighbors.reduce((acc, v) => {
            if (priorities.get(v)! > priorities.get(acc)!) acc = v;
            return acc;
        });
        if (!state.priorityNodes.includes(maxPriorityNeighbor)) state.priorityNodes.push(maxPriorityNeighbor)
        log({ maxPriorityNeighbor })

        if (state.priorityNodes.includes(self)) {
            addToVotes(suggestedValues);
        }

        state.nominationTimeout = setTimeout(() => {
            state.nominationRound++;
            determinePriorityNode();
        }, baseTimeoutValue + timeoutValue * state.nominationRound);
    }

    // Initialize
    const init = () => {
        determinePriorityNode();
    }


    // TODO: also return promise with result of the slot
    return { receive, init };
}