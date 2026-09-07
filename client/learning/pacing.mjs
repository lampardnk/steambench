export const ACT1_TARGET_MS = 60 * 60 * 1000;
export class Act1Timer {
  constructor(saved = null, now = () => Date.now()) {
    this.now = now;
    this.data = { startedAt: null, completedAt: null, modelMs: 0, inputMs: 0, waitMs: 0, ...saved };
  }
  start(state, freshRunVerified) {
    const neow = /neow/i.test(state.event?.name || state.event?.event_name || state.ancient?.name || '');
    if (!this.data.startedAt && freshRunVerified && state.run?.act === 1 && state.run?.floor === 1 && neow) this.data.startedAt = this.now();
  }
  observe(state) {
    // A boss death or rewards alone do not prove the act was cleared.
    if (this.data.startedAt && !this.data.completedAt && state.run?.act >= 2) this.data.completedAt = this.now();
  }
  add(kind, milliseconds) { if (this.data.startedAt && !this.data.completedAt && ['model', 'input', 'wait'].includes(kind)) this.data[`${kind}Ms`] += Math.max(0, milliseconds); }
  summary() {
    const elapsedMs = this.data.startedAt ? Math.max(0, (this.data.completedAt || this.now()) - this.data.startedAt) : 0;
    return { ...this.data, targetMs: ACT1_TARGET_MS, elapsedMs, remainingMs: Math.max(0, ACT1_TARGET_MS - elapsedMs), overrun: elapsedMs > ACT1_TARGET_MS, status: !this.data.startedAt ? 'not_started' : this.data.completedAt ? 'completed' : 'running' };
  }
}
