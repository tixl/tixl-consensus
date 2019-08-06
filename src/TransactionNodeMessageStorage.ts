import { Value, PublicKey } from './types';

interface MessageState {
  voted: boolean;
  accepted: boolean;
}

type MessageType = 'vote' | 'accept';

export default class TransactionNodeMessageStorage {
  data: Map<Value, Map<PublicKey, MessageState>>;
  constructor() {
    this.data = new Map();
  }

  set(t: Value, v: PublicKey, m: MessageType) {
    let dt: Map<PublicKey, MessageState>;
    if (this.data.has(t)) dt = this.data.get(t)!;
    else dt = new Map();

    let dtv: MessageState;
    if (dt.has(v)) dtv = dt.get(v)!;
    else dtv = { voted: false, accepted: false };
    switch (m) {
      case 'vote':
        dtv.voted = true;
        break;
      case 'accept':
        dtv.accepted = true;
        break;
    }
    dt.set(v, dtv);
    this.data.set(t, dt);
  }

  get(t: Value, ms: MessageType[]): PublicKey[] {
    if (this.data.has(t)) {
      const dt = this.data.get(t)!;
      const nodes = [];
      for (const [node, value] of dt) {
        if (ms.includes('vote') && value.voted === true) nodes.push(node);
        else if (ms.includes('accept') && value.accepted === true) nodes.push(node);
      }
      return nodes;
    }
    return [];
  }
}
