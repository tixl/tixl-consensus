import uuid from "uuid/v4";

export default class Transaction {
    id: string;
    from: string;
    to: string;
    timestamp: number;
    amount: number;

    constructor(from: string, to: string, amount: number) {
        this.timestamp = Date.now();
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.id = uuid();
    }

    isValid() {
        return this.timestamp <= Date.now()
    }
}