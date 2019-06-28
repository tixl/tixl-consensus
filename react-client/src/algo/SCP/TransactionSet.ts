import Transaction from "./Transaction";

export default class TransactionSet {
    transactions: Transaction[];
    index: Map<string, boolean>;

    constructor() {
        this.transactions = [];
        this.index = new Map;
    }

    addTransaction(t: Transaction) {
        if (!this.index.has(t.id)) {
            this.transactions.push(t);
            this.index.set(t.id, true);
        }
    }

    removeTransaction(t: Transaction) {
        if (this.index.has(t.id)) {
            // remove from array
            this.index.delete(t.id)
        }
    }

    addTransactions(transactions: Transaction[]) {
        transactions.forEach(t => this.addTransaction(t));
    }

    isValid() {
        return this.transactions.every(t => t.isValid());
    }

    merge(otherSet: TransactionSet) {
        const newSet = new TransactionSet();
        newSet.addTransactions(this.transactions);
        newSet.addTransactions(otherSet.transactions);
    }

}