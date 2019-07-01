
import { MessageArgs, Message } from './Message';
import { Transaction } from '../../SCP/Transaction';
import { VotingType } from '../FBASInstance';


export interface NominateMessageArgs extends MessageArgs {
    payload: {
        transactions: ReturnType<typeof Transaction>[]
    }
}

export const NominateMessage = (args: NominateMessageArgs) => Message({ ...args, votingType: VotingType.NOMINATE });