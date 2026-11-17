import {flightHeader} from './hudLayout';
/** Kept for existing callers; all devices share the same header geometry. */
export function mobileHeader(w: number) {
  return flightHeader(w,true);
}
