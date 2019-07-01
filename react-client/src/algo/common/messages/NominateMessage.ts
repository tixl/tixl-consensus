
import { MessageArgs, Message } from './Message';
import { Transaction, TransactionReturnType } from '../../SCP/Transaction';
import { VotingType } from '../../FBAS/FBASInstance';

export interface NominatePayload {
    transactions: TransactionReturnType[]
}

export interface NominateMessageArgs extends MessageArgs {
    payload: NominatePayload
}

export const NominateMessage = (args: NominateMessageArgs) => Message({ ...args, votingType: VotingType.NOMINATE });

export type NominateMessageReturnType = ReturnType<typeof NominateMessage>
