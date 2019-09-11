import { MessageEnvelope } from './types';
import chalk from 'chalk';

export const envelopeFormatter = (envelope: MessageEnvelope): string => {
  const sender = chalk.bold.green(envelope.sender.slice(0, 8) + ':');
  let type = '';
  switch (envelope.type) {
    case 'ScpNominate':
      type = chalk.green('NOM');
      break;
    case 'ScpPrepare':
      type = chalk.yellow('PREP');
      break;
    case 'ScpCommit':
      type = chalk.red('COM');
      break;
    case 'ScpExternalize':
      type = chalk.blue('EXT');
      break;
  }
  if (envelope.type === 'ScpNominate') {
    const vote = chalk.red(envelope.message.voted.sort().join('-'));
    const accept = chalk.yellow(envelope.message.accepted.sort().join('-'));
    return `${sender} ${type} VOTE ${vote} ACC ${accept}`;
  }
  if (envelope.type === 'ScpPrepare') {
    const msg = envelope.message;
    const msgStr = `<${msg.ballot.counter},${chalk.yellow(msg.ballot.value.join('-'))}> | Prepare <${msg.prepared &&
      msg.prepared.counter},${msg.prepared && msg.prepared.value.join('-')}> |  a ${msg.aCounter} h ${msg.hCounter} c ${
      msg.cCounter
    }`;
    return `${sender} ${type} - ${msgStr}`;
  }
  if (envelope.type === 'ScpCommit') {
    const msg = envelope.message;
    const msgStr = `<${msg.ballot.counter},${chalk.yellow(msg.ballot.value.join('-'))}> | preparedCounter ${
      msg.preparedCounter
    } c ${msg.cCounter} h ${msg.hCounter}`;
    return `${sender} ${type} - ${msgStr}`;
  }
  if (envelope.type === 'ScpExternalize') {
    const msg = envelope.message;
    const msgStr = `<${msg.commit.counter},${chalk.yellow(msg.commit.value.join('-'))}> | h ${msg.hCounter}`;
    return `${sender} ${type} - ${msgStr}`;
  }
  return '';
};
