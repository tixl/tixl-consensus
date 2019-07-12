import 'jest';
import TransactionNodeMessageStorage from './TransactionNodeMessageStorage';

describe('TransactionNodeMessageStorage', () => {
    test('should find the nodes that voted on a transaction', () => {
        const tnms = new TransactionNodeMessageStorage();
        tnms.set('transaction-1', 'node-1', 'vote')
        tnms.set('transaction-1', 'node-2', 'vote')
        tnms.set('transaction-1', 'node-3', 'vote')
        tnms.set('transaction-1', 'node-4', 'vote')
        tnms.set('transaction-1', 'node-5', 'vote')
        const result = tnms.get('transaction-1', ['vote']);
        expect(result).toEqual(['node-1', 'node-2', 'node-3', 'node-4', 'node-5'])
    })
});