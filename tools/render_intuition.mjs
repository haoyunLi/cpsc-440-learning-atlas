import fs from 'node:fs';
import { intuitionState } from '../assets/intuition.mjs';
const specs=JSON.parse(fs.readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(specs.map(s=>intuitionState(s.kind,s.value))));
