/* A one-shot "don't re-fit the viewport on the next doc sync" flag. Node drags
 * use the same trick from inside Canvas via skipNextFitView; a node-corner
 * resize sits outside Canvas, so it brands the flag here instead. */

let queued = false;

export function queueSkipNextDocFit() {
  queued = true;
}

export function takeSkipNextDocFit(): boolean {
  const value = queued;
  queued = false;
  return value;
}