import { ScpBallot, ScpPrepareEnvelope } from "../types";
import { ProtocolOptions, BroadcastFunction, checkQuorumForCounterFunction, checkBlockingSetForCounterFunction } from "../protocol";
import ProtocolState from '../ProtocolState';
import { hash, hashBallot, isBallotLower, hashBallotValue } from "../helpers";
import { quorumThreshold, blockingThreshold } from "../validateSlices";
import * as _ from 'lodash';



export const prepare = (state: ProtocolState, options: ProtocolOptions, broadcast: BroadcastFunction, log: (...args: any[]) => void, enterCommitPhase: () => void, checkQuorumForCounter: checkQuorumForCounterFunction, checkBlockingSetForCounter: checkBlockingSetForCounterFunction) => {
    const { self, slices } = options;

    const sent: bigint[] = [];

    const acceptPrepareBallot = (b: ScpBallot) => {
        const h = hashBallot(b);
        if (!state.acceptedPrepared.find(x => hashBallot(x) === h)) {
            log('ACCEPT prepare ballot', b.counter, b.value.join(' '));
            state.acceptedPrepared.push(b);
        }
        if (state.prepare.prepared === null || isBallotLower(state.prepare.prepared, b)) {
            state.prepare.prepared = b;
        }
        if (isBallotLower(state.prepare.ballot, b)) {
            state.prepare.ballot = b;
        }
    }

    const confirmPrepareBallot = (b: ScpBallot) => {
        const h = hashBallot(b);
        if (!state.confirmedPrepared.find(x => hashBallot(x) === h)) {
            log('CONFIRM prepare ballot', b.counter, b.value.join(' '));
            state.confirmedPrepared.push(b);
        }
    }

    const checkPrepareBallotAccept = (ballot: ScpBallot) => {
        // FIXME: What if we're already at another ballot
        // Track other ballots
        // TODO: include all the messages from above
        const ballotHash = hashBallot(ballot);
        const voteOrAccept = state.prepareStorage.getAllValuesAsArary()
            .filter(p => hashBallot(p.ballot) === ballotHash || (p.prepared && hashBallot(p.prepared) === ballotHash))
            .map(p => p.node);
        // log({ voteOrAccept })
        if (quorumThreshold(state.nodeSliceMap, voteOrAccept, self)) {
            acceptPrepareBallot(state.prepare.ballot);
        }
        const acceptPrepares = state.prepareStorage.getAllValuesAsArary()
            .filter(p => p.prepared && hashBallot(p.prepared) === ballotHash);
        const commits = state.commitStorage.getAllValuesAsArary()
            .filter(c => c.ballot && hashBallot(c.ballot) === ballotHash);
        const externalizes = state.externalizeStorage.getAllValuesAsArary()
            .filter(e => e.commit && hashBallot(e.commit) === ballotHash);
        const nodes = [...acceptPrepares, ...commits, ...externalizes].map(p => p.node);
        // log({ accepts })
        if (blockingThreshold(slices, nodes)) {
            acceptPrepareBallot(ballot);
        }
    }

    const checkPrepareBallotConfirm = (ballot: ScpBallot) => {
        // FIXME: include other messages
        const ballotHash = hashBallot(ballot);
        const acceptPrepares = state.prepareStorage.getAllValuesAsArary()
            .filter(p => p.prepared && hashBallot(p.prepared) === ballotHash)
            .map(p => p.node);
        const commits = state.commitStorage.getAllValuesAsArary()
            .filter(c => hashBallot({ counter: c.preparedCounter, value: c.ballot.value }) === ballotHash || hashBallot({ counter: c.hCounter, value: c.ballot.value }) === ballotHash)
            .map(c => c.node);
        const externalizes = state.externalizeStorage.getAllValuesAsArary()
            .filter(e => hashBallotValue(e.commit) === hashBallotValue(ballot))
            .map(e => e.node);
        const signers = _.uniq([...acceptPrepares, ...commits, ...externalizes]);
        if (quorumThreshold(state.nodeSliceMap, signers, self)) {
            confirmPrepareBallot(ballot);
        }
    }



    const recalculatePrepareBallotValue = (): void => {
        //  If any ballot has been confirmed prepared, then "ballot.value"
        // is taken to to be "h.value" for the highest confirmed prepared ballot "h". 
        const highestConfirmed = state.getHighestConfirmedPreparedBallot();
        if (highestConfirmed) {
            log('found highest confirmed')
            state.prepare.ballot.value = highestConfirmed.value;
            enterCommitPhase();
            return;
        }
        // Otherwise (if no such "h" exists), if one or more values are
        // confirmed nominated, then "ballot.value" is taken as the output
        // of the deterministic combining function applied to all
        // confirmed nominated values.
        if (state.confirmedValues.length) {
            state.prepare.ballot.value = state.confirmedValues;
            return;
        }

        // Otherwise, if no ballot is confirmed prepared and no value is
        // confirmed nominated, but the node has accepted a ballot
        // prepared (because "prepare(b)" meets blocking threshold for
        // some ballot "b"), then "ballot.value" is taken as the value of
        // the highest such accepted prepared ballot.
        const highestAccepted = state.getHighestAcceptedPreparedBallot();
        if (highestAccepted) {
            state.prepare.ballot.value = highestAccepted.value
            return;
        }
        log('Can not send PREPARE yet.')
        return;
    }

    const recalculatePreparedField = (): void => {
        //  or NULL if no ballot has been accepted prepared. 
        if (state.acceptedPrepared.length === 0) state.prepare.prepared = null;
        // The highest accepted prepared ballot not exceeding the "ballot" field
        const ballotsLowerThanPrepare = state.acceptedPrepared.filter(b => isBallotLower(b, state.prepare.ballot))
        if (ballotsLowerThanPrepare.length) {

            const highestAcceptedPreparedBallotNotExceedingBallotField =
                ballotsLowerThanPrepare.reduce((acc, b) => {
                    if (isBallotLower(acc, b)) acc = b;
                    return acc;
                })
            state.prepare.prepared = highestAcceptedPreparedBallotNotExceedingBallotField!;
            if (state.prepare.ballot.value.length < state.prepare.prepared.value.length && state.prepare.ballot.counter === state.prepare.prepared.counter) {
                state.prepare.prepared.counter = state.prepare.ballot.counter - 1;
                // Note:  it is not possible to vote to commit a ballot with counter 0.
            }
        }
    }

    const recalculateACounter = (oldPrepared: ScpBallot | null) => {
        if (!oldPrepared) return;
        if (hashBallotValue(oldPrepared) !== hashBallotValue(state.prepare.prepared)) {
            if (oldPrepared.value.length < state.prepare.prepared!.value.length) {
                state.prepare.aCounter = oldPrepared.counter;
            }
            else {
                state.prepare.aCounter = oldPrepared.counter + 1;
            }
        }
    }

    const recalculateHCounter = () => {
        const highestConfirmed = state.getHighestConfirmedPreparedBallot();
        if (highestConfirmed && hashBallotValue(highestConfirmed) === hashBallotValue(state.prepare.ballot)) {
            state.prepare.hCounter = highestConfirmed.counter;
        }
        else {
            state.prepare.hCounter = 0;
        }
    }

    const updateCommitBallot = () => {
        if ((state.commitBallot && isBallotLower(state.commitBallot, state.prepare.prepared!) && hashBallotValue(state.prepare.prepared) !== hashBallotValue(state.commitBallot))
            || state.prepare.aCounter > state.prepare.cCounter) {
            state.commitBallot = null;
        }
        if (state.commitBallot === null && state.prepare.hCounter === state.prepare.ballot.counter) {
            state.commitBallot = state.prepare.ballot;
        }
    }

    const recalculateCCounter = () => {
        updateCommitBallot();
        if (state.commitBallot === null || state.prepare.hCounter === 0) { state.prepare.cCounter = 0; }
        else { state.prepare.cCounter = state.commitBallot.counter; }
    }

    const sendPrepareMessage = () => {
        const payload = {
            message: state.prepare,
            sender: self,
            type: "ScpPrepare" as 'ScpPrepare',
            slices
        }
        const msg: ScpPrepareEnvelope = {
            ...payload,
            timestamp: Date.now(),
        }
        const h = hash(payload);
        if (!sent.includes(h)) {
            sent.push(h);
            broadcast(msg);
        }
    }

    const checkEnterCommitPhase = () => {
        if (state.confirmedPrepared.length) {
            enterCommitPhase();
        }
    }

    const enterPreparePhase = () => {
        state.phase = 'PREPARE'
        log('Entering Prepare Phase')
        state.prepare.ballot.value = state.confirmedValues;
        sendPrepareMessage();
    }

    // TODO: Include Counter limit logic
    const receivePrepare = (envelope: ScpPrepareEnvelope) => {
        state.prepareStorage.set(envelope.sender, envelope.message, envelope.timestamp);
        checkPrepareBallotAccept(state.prepare.ballot);
        checkPrepareBallotAccept(envelope.message.ballot);
        if (state.prepare.prepared) {
            checkPrepareBallotConfirm(state.prepare.prepared);
        }
        if (state.phase === "PREPARE") {

            const currentCounter = state.prepare.ballot.counter;
            checkQuorumForCounter(() => state.prepare.ballot.counter++);
            checkBlockingSetForCounter((value: number) => state.prepare.ballot.counter = value);
            if (state.prepare.ballot.counter !== currentCounter) {
                recalculatePrepareBallotValue();
            }
            const oldPrepared = state.prepare.prepared;
            recalculatePreparedField();
            if (hashBallotValue(oldPrepared) !== hashBallotValue(state.prepare.prepared)) {
                recalculateACounter(oldPrepared);
            }
            recalculateHCounter();
            recalculateCCounter();
            sendPrepareMessage();
            checkEnterCommitPhase();
        }
    }

    return {
        receivePrepare,
        enterPreparePhase
    }
}