import { ScpCommitEnvelope, ScpBallot } from "../types";
import { BroadcastFunction } from "../protocol";
import ProtocolState from '../ProtocolState';
import { hashBallot, hashBallotValue, checkBlockingSetForCounterCommit, isBallotLower, checkQuorumForCounter } from "../helpers";
import { quorumThreshold, blockingThreshold } from "../validateSlices";
import * as _ from 'lodash';


export const commit = (state: ProtocolState, broadcast: BroadcastFunction, enterExternalizePhase: () => void) => {
    const log = (...args: any[]) => state.log(...args);

    // const acceptCommitBallot = (ballot: ScpBallot) => {
    //     const h = hashBallot(ballot);
    //     if (!state.acceptedCommitted.find(x => hashBallot(x) !== h)) {
    //         state.acceptedCommitted.push(ballot)
    //     }
    // }

    const confirmCommitBallot = (ballot: ScpBallot) => {
        const h = hashBallot(ballot);
        if (state.confirmedCommitted.map(hashBallot).indexOf(h) < 0) {
            log('!!!!!!!!!!!!!!!!!!!!!!!!!!')
            log('CONFIRMED BALLOT ', ballot.counter, ballot.value.join(' '))
            state.confirmedCommitted.push(ballot)
        }
    }

    const checkCommitBallotAccept = () => {
        const n = state.commit.ballot.counter;
        const votesOrAccepts = state.commitStorage.getAllValuesAsArary()
            .filter(c =>
                // accepts
                (hashBallotValue(c.ballot) === hashBallotValue(state.commit.ballot) && (c.cCounter >= state.commit.ballot.counter && c.hCounter <= state.commit.ballot.counter))
                // votes
                || (hashBallotValue(c.ballot) === hashBallotValue(state.commit.ballot) && n >= c.cCounter)
            ).map(c => c.node);
        if (quorumThreshold(state.nodeSliceMap, votesOrAccepts, state.options.self)) {
            state.addAcceptedCommited(state.commit.ballot) && log('accept commit ', state.commit.ballot)
        }
        const accepts = state.commitStorage.getAllValuesAsArary()
            .filter(c =>
                // accepts
                (hashBallotValue(c.ballot) === hashBallotValue(state.commit.ballot) && (c.cCounter <= n && n <= c.hCounter))
            ).map(c => c.node);
        if (blockingThreshold(state.options.slices, accepts)) {
            state.addAcceptedCommited(state.commit.ballot) && log('accept commit ', state.commit.ballot)
        }
    }

    const checkCommitBallotConfirm = () => {
        const n = state.commit.ballot.counter;
        const ballotValueHash = hashBallotValue(state.commit.ballot);
        const acceptCommits = state.commitStorage.getAllValuesAsArary()
            .filter(c =>
                // accepts
                (hashBallotValue(c.ballot) === ballotValueHash && (c.cCounter <= n && n <= c.hCounter))
            )
        const externalizes = state.externalizeStorage.getAllValuesAsArary()
            .filter(x => hashBallotValue(x.commit) === ballotValueHash);
        const signers = [...acceptCommits, ...externalizes].map(x => x.node);
        if (quorumThreshold(state.nodeSliceMap, signers, state.options.self)) {
            confirmCommitBallot(state.commit.ballot);
        }
    }

    const recalculatePreparedCounter = () => {
        // TODO: Check if this is complete / right
        const highest = state.getHighestAcceptedPreparedBallot();
        if (isBallotLower(state.commit.ballot, highest!)) {
            state.commit.preparedCounter = state.commit.ballot.counter - 1;
        }
        else {
            state.commit.preparedCounter = highest!.counter;
        }
        log('Set prepare counter to ', state.commit.preparedCounter)
    }

    const recalculateCommitCCounter = () => {
        // TODO: how to set this when no ballots in acceptedCommited
        if (state.acceptedCommitted.length) {
            const min = Math.min(...state.acceptedCommitted.map(x => x.counter))
            state.commit.cCounter = _.cloneDeep(min);
        }
        else {
            state.commit.cCounter = 0;
        }

    }

    const recalculateCommitHCounter = () => {
        const max = Math.max(...state.acceptedCommitted.map(x => x.counter), 0)
        state.commit.hCounter = _.cloneDeep(max);
    }

    const sendCommitMessage = () => {
        const msg: ScpCommitEnvelope = {
            message: state.commit,
            sender: state.options.self,
            type: "ScpCommit" as "ScpCommit",
            timestamp: Date.now(),
            slices: state.options.slices
        }
        broadcast(msg);
    }

    const checkEnterExternalizePhase = () => {
        if (state.confirmedCommitted.length) {
            enterExternalizePhase();
        }
    }

    const enterCommitPhase = () => {
        state.phase = "COMMIT";
        if (state.acceptedCommitted.length === 0) {
            throw new Error('must have an accepted commited ballot to enter commit phase')
        }
        if (!state.prepare.prepared) {
            throw new Error('Should not be empty')
        }
        log('Entering Commit Phase')
        state.commit.ballot = _.cloneDeep(state.prepare.prepared);
        state.commit.preparedCounter = state.prepare.prepared!.counter;
        sendCommitMessage();
    }

    const receiveCommit = (envelope: ScpCommitEnvelope) => {
        state.commitStorage.set(envelope.sender, envelope.message, envelope.timestamp);
        checkCommitBallotAccept();
        checkCommitBallotConfirm();
    }

    const doCommitUpdate = () => {
        // checkCommitBallotAccept();
        checkQuorumForCounter(state, () => {
            state.commit.ballot.counter++
            doCommitUpdate();
        });
        checkBlockingSetForCounterCommit(state, (value: number) => state.commit.ballot.counter = _.cloneDeep(value));
        recalculatePreparedCounter();
        recalculateCommitCCounter();
        recalculateCommitHCounter();
        sendCommitMessage();
        checkEnterExternalizePhase();
    }

    return { receiveCommit, enterCommitPhase, doCommitUpdate }
}