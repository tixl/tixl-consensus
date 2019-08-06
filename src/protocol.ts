import { PublicKey, MessageEnvelope, BroadcastFunction, ProtocolOptions } from './types';
import { getNeighbors, getPriority } from './neighbors';
import * as _ from 'lodash';
import ProtocolState from './ProtocolState';
import { commit } from './phases/commit';
import { prepare } from './phases/prepare';
import { nominate } from './phases/nominate';
import { externalize } from './phases/externalize';
import { hash } from './helpers';
import chalk from 'chalk';
import { envelopeFormatter } from './formatters';

export type checkQuorumForCounterFunction = (increaseFunc: () => void) => void;
export type checkBlockingSetForCounterFunction = (setFunc: (value: number) => void) => void;

const baseTimeoutValue = 1000;
const timeoutValue = 1000;

export const protocol = (broadcast: BroadcastFunction, options: ProtocolOptions) => {
  const state = new ProtocolState(options);
  const log = (...args: any[]) => state.log(...args);

  const sentMessages = new Map<bigint, boolean>();
  const sendEnvelope = (envelope: MessageEnvelope) => {
    const h = hash({ ...envelope, timestamp: null });
    if (!sentMessages.has(h)) {
      sentMessages.set(h, true);
      if (state.options.logMessages)
        console.log(
          chalk.green(`${state.options.slot} Node ${chalk.bold(envelope.sender)} sends    `),
          envelopeFormatter(envelope),
        );
      broadcast(envelope);
    }
  };

  const { receiveExternalize, enterExternalizePhase } = externalize(state, sendEnvelope);
  const { receiveCommit, enterCommitPhase, doCommitUpdate, checkMessageStatesForCommit } = commit(
    state,
    sendEnvelope,
    enterExternalizePhase,
  );
  const { receivePrepare, enterPreparePhase, doPrepareUpdate, checkMessageStatesForPrepare } = prepare(
    state,
    sendEnvelope,
    enterCommitPhase,
  );
  const { receiveNominate, addToVotes } = nominate(state, sendEnvelope, enterPreparePhase);

  const receive = (envelope: MessageEnvelope) => {
    // TODO: Find a better way to set the slices
    if (state.options.logMessages)
      console.log(
        chalk.red(`${state.options.slot} Node ${chalk.bold(state.options.self)} receives `),
        envelopeFormatter(envelope),
      );
    state.nodeSliceMap.set(envelope.sender, envelope.slices);
    switch (envelope.type) {
      case 'ScpNominate':
        receiveNominate(envelope);
        break;
      case 'ScpPrepare':
        receivePrepare(envelope);
        break;
      case 'ScpCommit':
        receiveCommit(envelope);
        break;
      case 'ScpExternalize':
        receiveExternalize(envelope);
        break;
      default:
        throw new Error('unknown message type');
    }
    if (state.phase !== 'NOMINATE') {
      checkMessageStatesForPrepare();
      checkMessageStatesForCommit();
    }
    switch (state.phase) {
      case 'COMMIT':
        doCommitUpdate();
        break;
      case 'PREPARE':
        doPrepareUpdate();
        break;
      default:
        break;
    }
  };

  const determinePriorityNode = () => {
    const neighbors = [
      state.options.self,
      ...getNeighbors(state.options.slot, state.nominationRound, state.options.slices),
    ];
    const priorities = new Map<PublicKey, BigInt>();
    neighbors.forEach(v => priorities.set(v, getPriority(state.options.slot, state.nominationRound, v)));

    const maxPriorityNeighbor: PublicKey = neighbors.reduce((acc, v) => {
      if (priorities.get(v)! > priorities.get(acc)!) acc = v;
      return acc;
    });
    if (!state.priorityNodes.includes(maxPriorityNeighbor)) {
      state.priorityNodes.push(maxPriorityNeighbor);
      // add votes from newly elected leader
      const lastNominate = state.nominateStorage.getValueFromNode(maxPriorityNeighbor);
      if (lastNominate) {
        addToVotes([...lastNominate.accepted, ...lastNominate.voted]);
      }
    }
    log({ maxPriorityNeighbor });

    if (state.priorityNodes.includes(state.options.self)) {
      addToVotes(state.options.suggestedValues);
    }

    state.nominationTimeout = setTimeout(() => {
      state.nominationRound++;
      determinePriorityNode();
    }, baseTimeoutValue + timeoutValue * state.nominationRound);
  };

  // Initialize
  const init = () => {
    determinePriorityNode();
  };

  return { receive, init };
};
