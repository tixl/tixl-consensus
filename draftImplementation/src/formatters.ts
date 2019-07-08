import { MessageEnvelope } from './types';
import chalk from 'chalk';

export const envelopeFormatter = (envelope: MessageEnvelope): string => {
    const sender = chalk.bold.green(envelope.sender + ":");
    const type = envelope.type === 'ScpNominate' ? chalk.green('NOM') : '???'
    if (envelope.type === 'ScpNominate') {
        const vote = chalk.red(envelope.message.voted.sort().join(' '))
        const accept = chalk.yellow(envelope.message.accepted.sort().join(' '))
        return `${sender} ${type} VOTE ${vote} ACC ${accept}`
    }
    return '';
}