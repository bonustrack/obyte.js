import { chashGetChash160, getSourceString } from './internal';

export function getChash160(obj) {
  return chashGetChash160(getSourceString(obj));
}
