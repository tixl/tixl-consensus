import uuid from "uuid/v4";

export interface TransactionArgs {
    from: string,
    to: string,
    id?: string,
    amount: number,
    timestamp?: number,
}

export const Transaction = ({ id, from, to, timestamp, amount }: TransactionArgs) => ({
    from,
    to,
    amount,
    timestamp: timestamp || Date.now(),
    id: id || uuid()
})