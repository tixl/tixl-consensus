import fs = require('fs');
import * as toml from 'toml';

export const parseConfig = (file: string) => {
  const cfgFile = fs.readFileSync('./' + file, 'utf8');
  const config = toml.parse(cfgFile);
  const nodes = config.nodes as any;
  return { nodes };
};
