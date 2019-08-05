import fs = require('fs');
import * as toml from 'toml';
import { PublicKey, ScpSlices } from './types';

export const parseConfig = (file: string) => {

    const cfgFile = fs.readFileSync('./' + file, "utf8");
    const config = toml.parse(cfgFile)
    const pk = config.pk as PublicKey;
    const slices = config.slices as ScpSlices;
    const ports = config.ports as number[];
    const port = config.port as number;
    return { pk, slices, port, ports };
}
