import {
  PublicKey,
  ScpSlices,
  ScpPrepare,
  ScpCommit,
  ScpExternalize,
  ScpBallot,
  ScpNominate,
  Value,
  ScpPrepareEnvelope,
} from './types';
import TransactionNodeMessageStorage from './TransactionNodeMessageStorage';
import { GenericStorage } from './GenericStorage';
import { isBallotLower, hashBallot } from './helpers';
import { ProtocolOptions } from './index';
import { Logger } from 'winston';
import * as _ from 'lodash';
import { createDefaultLogger } from './defaultLogger';

export type ProtocolPhase = 'NOMINATE' | 'PREPARE' | 'COMMIT' | 'EXTERNALIZE';

export default class ProtocolState {
  phase: ProtocolPhase;
  logger: Logger;
  nominationTimeout: NodeJS.Timeout | null;
  counterTimeout: NodeJS.Timeout | null;
  nominationRepeatTimeout: NodeJS.Timeout | null;
  prepareTimeoutCounter: number;
  nominationRound: number;
  priorityNodes: PublicKey[];
  TNMS: TransactionNodeMessageStorage;
  nodeSliceMap: Map<PublicKey, ScpSlices>;
  nominateStorage: GenericStorage<ScpNominate>;
  prepareStorage: GenericStorage<ScpPrepare>;
  commitStorage: GenericStorage<ScpCommit>;
  externalizeStorage: GenericStorage<ScpExternalize>;
  lastReceivedPrepareEnvelope: null | ScpPrepareEnvelope;
  acceptedPrepared: ScpBallot[];
  confirmedPrepared: ScpBallot[];
  acceptedCommitted: ScpBallot[];
  confirmedCommitted: ScpBallot[];
  commitBallot: ScpBallot | null;
  confirmedValues: Value[];
  nominate: ScpNominate;
  prepare: ScpPrepare;
  commit: ScpCommit;
  externalize: ScpExternalize;
  options: ProtocolOptions;

  constructor(options: ProtocolOptions, logger?: Logger) {
    this.options = options;
    this.logger = logger || createDefaultLogger();
    this.phase = 'NOMINATE';
    this.nominationTimeout = null;
    this.counterTimeout = null;
    this.nominationRepeatTimeout = null;
    this.prepareTimeoutCounter = 0;
    this.nominationRound = 1;
    this.priorityNodes = [];
    this.TNMS = new TransactionNodeMessageStorage();
    this.nodeSliceMap = new Map();
    this.nodeSliceMap.set(options.self, options.slices);
    this.nominateStorage = new GenericStorage<ScpNominate>();
    this.prepareStorage = new GenericStorage<ScpPrepare>();
    this.commitStorage = new GenericStorage<ScpCommit>();
    this.externalizeStorage = new GenericStorage<ScpExternalize>();
    this.lastReceivedPrepareEnvelope = null;
    this.acceptedPrepared = [];
    this.confirmedPrepared = [];
    this.acceptedCommitted = [];
    this.confirmedCommitted = [];
    this.commitBallot = null;
    this.confirmedValues = [];
    this.nominate = {
      voted: [],
      accepted: [],
    };
    this.prepare = {
      ballot: { counter: 1, value: [] },
      prepared: null,
      aCounter: 0,
      hCounter: 0,
      cCounter: 0,
    };
    this.commit = {
      ballot: { counter: 1, value: [] },
      preparedCounter: 0,
      hCounter: 0,
      cCounter: 0,
    };
    this.externalize = {
      commit: { counter: 1, value: [] },
      hCounter: 0,
    };
  }

  getHighestConfirmedPreparedBallot() {
    if (this.confirmedPrepared.length) {
      const highestConfirmed = this.confirmedPrepared.reduce((acc, b) => {
        if (isBallotLower(acc, b)) acc = b;
        return acc;
      });
      return highestConfirmed;
    }
    return null;
  }

  getHighestAcceptedPreparedBallot() {
    if (this.acceptedPrepared.length) {
      const highestAccepted = this.acceptedPrepared.reduce((acc, b) => {
        if (isBallotLower(acc, b)) acc = b;
        return acc;
      });
      return highestAccepted;
    }
    return null;
  }

  addAcceptedPrepared(b: ScpBallot) {
    const h = hashBallot(b);
    if (this.acceptedPrepared.map(hashBallot).indexOf(h) < 0) {
      this.acceptedPrepared.push(_.cloneDeep(b));
      return true;
    }
    return false;
  }

  addConfirmedPrepared(b: ScpBallot) {
    const h = hashBallot(b);
    if (this.confirmedPrepared.map(hashBallot).indexOf(h) < 0) {
      this.confirmedPrepared.push(_.cloneDeep(b));
      return true;
    }
    return false;
  }

  addAcceptedCommited(b: ScpBallot) {
    const h = hashBallot(b);
    if (this.acceptedCommitted.map(hashBallot).indexOf(h) < 0) {
      this.acceptedCommitted.push(_.cloneDeep(b));
      return true;
    }
    return false;
  }

  addConfirmedCommited(b: ScpBallot) {
    const h = hashBallot(b);
    if (this.confirmedCommitted.map(hashBallot).indexOf(h) < 0) {
      this.confirmedCommitted.push(_.cloneDeep(b));
      return true;
    }
    return false;
  }
}
