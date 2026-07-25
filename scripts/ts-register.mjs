// Registers the workspace TS resolve hook, then nothing else. Use as:
//   node --import ./scripts/ts-register.mjs <script>.ts
import { register } from 'node:module';
register('./ts-loader.mjs', import.meta.url);
