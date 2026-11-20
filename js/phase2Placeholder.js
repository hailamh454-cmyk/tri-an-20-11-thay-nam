/**
 * phase2Placeholder.js
 * Seamless Hook & Bridge connecting Phase 1 completion with Phase 2.
 * Ready for:
 * - Step 2.1: Camera Dolly-Zoom into Blackboard
 * - Step 2.2: 1m44s Memorial Video playback (assets/sakura_no_uta_memories.mp4)
 * - Step 2.3: Autumn Falling Leaves Canvas (Koe no Katachi aesthetic)
 */

export class Phase2Controller {
  constructor() {
    this.isTriggered = false;
    this.modalEl = document.getElementById('phase2-modal');
    this.closeBtn = document.getElementById('btn-phase2-close');
    this.replayBtn = document.getElementById('btn-phase2-replay');
    this.onReplayCallback = null;

    this.bindEvents();
  }

  bindEvents() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => {
        if (this.modalEl) this.modalEl.classList.add('hidden');
      });
    }

    if (this.replayBtn) {
      this.replayBtn.addEventListener('click', () => {
        if (this.modalEl) this.modalEl.classList.add('hidden');
        if (this.onReplayCallback) this.onReplayCallback();
      });
    }
  }

  /**
   * Called by EraserController when blackboard is >= 80% wiped clean.
   */
  triggerPhase2(replayCallback) {
    this.isTriggered = true;
    this.onReplayCallback = replayCallback;

    console.log('[Phase 2 Hook] Phase 1 finished successfully! Blackboard wiped clean.');
    console.log('[Phase 2 Hook] Ready to initialize Phase 2 cinematic video sequence (assets/sakura_no_uta_memories.mp4).');

    if (this.modalEl) {
      this.modalEl.classList.remove('hidden');
    }
  }
}

export const phase2Bridge = new Phase2Controller();
