import {readFileSync} from 'node:fs';
import {evaluate} from '../web/core.mjs';
const catalogue=JSON.parse(readFileSync(new URL('../web/data/facilities.json',import.meta.url)));
const input=JSON.parse(process.argv[2]||'{}');
process.stdout.write(JSON.stringify(evaluate(catalogue,input)));
