import {readFileSync,writeFileSync} from 'node:fs';
import {evaluate} from '../web/core.mjs';import {renderSVG} from '../web/render.mjs';
const cat=JSON.parse(readFileSync(new URL('../web/data/facilities.json',import.meta.url)));
const result=evaluate(cat,JSON.parse(process.argv[2]||'{}'));
const dest=process.argv[3]||'radio-array-explorer.svg';writeFileSync(dest,renderSVG(result));console.log(dest);
