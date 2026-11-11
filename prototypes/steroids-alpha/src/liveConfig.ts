import { TUNE } from '../sim/tune';
import { parseRecord } from '../sim/liveConfig';
import { clientTune } from './clientTune';
import { CALIBRATION } from './render/shipArt';
export let configVersion = 'bundled';
export function applyServerConfig(input:unknown):boolean {
  const record=parseRecord(input);if(record.version===configVersion)return false;
  for(const group of ['ship','weapon','asteroid','planet'] as const)Object.assign(TUNE[group],structuredClone(record.data.tune[group]));
  Object.assign(clientTune.render,record.data.clientTune.render);
  Object.assign(CALIBRATION,structuredClone(record.data.calibration));
  configVersion=record.version;return true;
}
