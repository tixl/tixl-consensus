import { ScpCommitEnvelope, ScpBallot } from "../types";
import { BroadcastFunction } from "../protocol";
import ProtocolState from '../ProtocolState';
import { hashBallot, hashBallotValue, checkQuorumForCounter, checkBlockingSetForCounter } from "../helpers";
import { quorumThreshold, blockingThreshold } from "../validateSlices";
import * as _ from 'lodash';


export const commit = (state: ProtocolState, broadcast: BroadcastFunction, enterExternalizePhase: () => void) => {
    const log = (...args: any[]) => state.log(...args);

    const acceptCommitBallot = (ballot: ScpBallot) => {
        const h = hashBallot(ballot);
        if (!state.acceptedCommitted.find(x => hashBallot(x) !== h)) {
            state.acceptedCommitted.push(ballot)
        }
    }

    const confirmCommitBallot = (ballot: ScpBallot) => {
        const h = hashBallot(ballot);
        if (state.confirmedCommitted.find(x => hashBallot(x) === h) === undefined) {
            log('!!!!!!!!!!!!!!!!!!!!!!!!!!')
            log('CONFIRMED BALLOT ', ballot.counter, ballot.value.join(' '))
            state.confirmedCommitted.push(ballot)
        }
    }

    const checkCommitBallotAccept = () => {
        const votesOrAccepts = state.commitStorage.getAllValuesAsArary()
            .filter(c =>
                // accepts
                (hashBallotValue(c.ballot) === hashBallotValue(state.commit.ballot) && (c.cCounter >= state.commit.ballot.counter && c.hCounter <= state.commit.ballot.counter))
                // votes
                || (hashBallotValue(c.ballot) === hashBallotValue(state.commit.ballot) && state.commit.ballot.counter >= c.cCounter)
            ).map(c => c.node);
        if (quorumThreshold(state.nodeSliceMap, votesOrAccepts, state.options.self)) {
            acceptCommitBallot(state.commit.ballot);
        }
        const accepts = state.commitStorage.getAllValuesAsArary()
            .filter(c =>
                // accepts
                (hashBallotValue(c.ballot) === hashBallotValue(state.commit.ballot) && (c.cCounter >= state.commit.ballot.counter && c.hCounter <= state.commit.ballot.counter))
            ).map(c => c.node);
        if (blockingThreshold(state.options.slices, accepts)) {
            acceptCommitBallot(state.commit.ballot);
        }
    }

    const checkCommitBallotConfirm = () => {
        const accepts = state.commitStorage.getAllValuesAsArary()
            .filter(c =>
                // accepts
                (hashBallotValue(c.ballot) === hashBallotValue(state.commit.ballot) && (c.cCounter >= state.commit.ballot.counter && c.hCounter <= state.commit.ballot.counter))
            ).map(c => c.node);
        if (quorumThreshold(state.nodeSliceMap, accepts, state.options.self)) {
            confirmCommitBallot(state.commit.ballot);
        }
    }

    const recalculatePreparedCounter = () => {
        // TODO: Check if this is complete / right
        const highestAccepted = state.getHighestAcceptedPreparedBallot()
        if (highestAccepted) {
            state.commit.preparedCounter = highestAccepted.counter;
        }
    }

    const recalculateCommitCCounter = () => {
        // TODO: how to set this when no ballots in acceptedCommited
        if (state.acceptedCommitted.length) {
            const min = Math.min(...state.acceptedCommitted.map(x => x.counter))
            state.commit.cCounter = min;
        }
        else {
            state.commit.cCounter = 0;
        }

    }

    const recalculateCommitHCounter = () => {
        const max = Math.max(...state.acceptedCommitted.map(x => x.counter), 0)
        state.commit.hCounter = max;
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
        if (confirmCommitBallot.length) {
            enterExternalizePhase();
        }
    }

    const enterCommitPhase = () => {
        log('Entering Commit Phase')
        state.phase = "COMMIT";
        state.commit.ballot = state.prepare.ballot;
        state.commit.preparedCounter = state.prepare.prepared!.counter;
        sendCommitMessage();
    }

    const receiveCommit = (envelope: ScpCommitEnvelope) => {
        state.commitStorage.set(envelope.sender, envelope.message, envelope.timestamp);
        checkCommitBallotAccept();
        checkCommitBallotConfirm();
        if (state.phase === 'COMMIT') {
            checkQuorumForCounter(state, () => state.commit.ballot.counter++);
            checkBlockingSetForCounter(state, (value: number) => state.commit.ballot.counter = value);
            recalculatePreparedCounter();
            recalculateCommitCCounter();
            recalculateCommitHCounter();
            sendCommitMessage();
            checkEnterExternalizePhase();
        }
    }

    return { receiveCommit, enterCommitPhase }
}