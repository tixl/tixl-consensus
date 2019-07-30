import { ScpCommitEnvelope } from "../types";
import { BroadcastFunction } from "../protocol";
import ProtocolState from '../ProtocolState';
import { hashBallotValue, isBallotLower, infinityCounter } from "../helpers";
import { quorumThreshold, blockingThreshold } from "../validateSlices";
import * as _ from 'lodash';


export const commit = (state: ProtocolState, broadcast: BroadcastFunction, enterExternalizePhase: () => void) => {
    const log = (...args: any[]) => state.log(...args);

    const checkCommitBallotAccept = () => {
        const ballot = state.commit.ballot;
        const ballotValueHash = hashBallotValue(ballot)
        const n = ballot.counter;
        const prepareCommitVotes = state.prepareStorage.getAllValuesAsArary()
            .filter(x => hashBallotValue(x.ballot) === ballotValueHash && (x.cCounter <= n && n <= x.hCounter));
        const commits = state.commitStorage.getAllValuesAsArary()
            // accept commit for cCounter <= n <= hCounter && vote for n >= cCounter result in no restrictions for counters 
            .filter(x => hashBallotValue(x.ballot) === ballotValueHash && n >= x.cCounter);
        const externalizes = state.externalizeStorage.getAllValuesAsArary()
            .filter(x => hashBallotValue(x.commit) && n >= x.commit.counter);
        const signersVoteOrAccept = [...prepareCommitVotes, ...commits, ...externalizes].map(x => x.node);
        if (quorumThreshold(state.nodeSliceMap, signersVoteOrAccept, state.options.self)) {
            state.addAcceptedCommited(ballot) && log('Accept commit (Quorum) ', ballot)
        }

        const commitAccepts = state.commitStorage.getAllValuesAsArary()
            .filter(x => hashBallotValue(x.ballot) === ballotValueHash && x.cCounter <= n && n <= x.hCounter);
        const signersAccept = [...commitAccepts, ...externalizes].map(x => x.node);
        if (blockingThreshold(state.options.slices, signersAccept)) {
            state.addAcceptedCommited(ballot) && log('Accept Commit (Blocking Set)', ballot)
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
            state.addConfirmedCommited(state.commit.ballot) && log('Confirm Commit (Quorum)', state.commit.ballot)
        }
    }

    const recalculatePreparedCounter = () => {
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
        state.commit.hCounter = max;
    }

    const checkCounterBlockingSet = () => {
        const currentCounter = state.commit.ballot.counter;
        if (currentCounter === infinityCounter) return false;
        const fromPrepare = state.prepareStorage.getAllValuesAsArary().filter(x => x.ballot.counter > currentCounter);
        const fromCommit = state.commitStorage.getAllValuesAsArary().filter(x => x.ballot.counter > currentCounter);
        const fromExternalize = state.externalizeStorage.getAllValuesAsArary();
        const hasExternalizeMessage = fromExternalize.length > 0
        const counters = [...fromPrepare.map(x => x.ballot.counter), ...fromCommit.map(x => x.ballot.counter)];
        const nodes = [...fromPrepare, ...fromCommit, ...fromExternalize].map(x => x.node)
        if (blockingThreshold(state.options.slices, nodes)) {
            const minCounter = hasExternalizeMessage ? Math.min(...counters, infinityCounter) : Math.min(...counters);
            log(`Found blocking set for timers: increase from ${state.commit.ballot.counter} to ${minCounter}`)
            state.commit.ballot.counter = minCounter;
            checkCounterBlockingSet(); // do recursively
            return true;
        } else {
            return false;
        }
    }

    const armQuorumCounterTimer = () => {
        const currentCounter = state.commit.ballot.counter;
        log('Arming timer for current counter ', currentCounter)
        if (state.counterTimeout) clearTimeout(state.counterTimeout);
        state.counterTimeout = setTimeout(() => {
            log(`Timer fired for counter ${state.commit.ballot.counter}: increasing to ${state.commit.ballot.counter + 1}`)
            state.commit.ballot.counter++;
            doCommitUpdate();
        }, (currentCounter + 1) * 1000)
    }

    const checkCounterQuorum = () => {
        const currentCounter = state.commit.ballot.counter;
        const fromPrepare = state.prepareStorage.getAllValuesAsArary().filter(x => x.ballot.counter >= currentCounter);
        const fromCommit = state.commitStorage.getAllValuesAsArary().filter(x => x.ballot.counter >= currentCounter);
        const fromExternalize = state.externalizeStorage.getAllValuesAsArary();
        const nodes = [...fromPrepare, ...fromCommit, ...fromExternalize].map(x => x.node)
        if (quorumThreshold(state.nodeSliceMap, nodes, state.options.self)) {
            armQuorumCounterTimer();
        }
    }

    const checkUpdateCounter = () => {
        if (checkCounterBlockingSet()) {
            doCommitUpdate();
            state.counterTimeout && clearTimeout(state.counterTimeout)
        }
        checkCounterQuorum();
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
        doCommitUpdate();
    }

    const checkMessageStatesForCommit = () => {
        checkCommitBallotAccept();
        checkCommitBallotConfirm();
    }

    const receiveCommit = (envelope: ScpCommitEnvelope) => {
        state.commitStorage.set(envelope.sender, envelope.message, envelope.timestamp);
    }

    const doCommitUpdate = () => {
        checkUpdateCounter();
        recalculatePreparedCounter();
        recalculateCommitCCounter();
        recalculateCommitHCounter();
        sendCommitMessage();
        checkEnterExternalizePhase();
    }

    return { receiveCommit, enterCommitPhase, doCommitUpdate, checkMessageStatesForCommit }
}