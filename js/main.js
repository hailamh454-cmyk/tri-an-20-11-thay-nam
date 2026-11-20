/**
 * js/main.js
 * 
 * Central Orchestrator & State Machine for 3D Autumn Classroom & Diegetic Blackboard.
 * Complies with Google Antigravity 3D WebGL & Physics Standards (.agents/rules/3d-physics-standards.md).
 * 
 * Architecture:
 * 1. Full 3D WebGL Scene via Three.js (assets/classroom.glb loaded into renderer).
 * 2. 100% Diegetic Chalkboard UI (ZERO external HTML buttons/sliders).
 * 3. Numerical RK4 Physics Integrator (Levels 1-3).
 * 4. 3D Teacher Desk Vintage Kraft Envelope & Handwritten Tribute Modal.
 * 5. Black Hole Singularity Implosion & 88-Formula Zero-Collision Supernova.
 * 6. Procedural Chalk Felt Eraser with 80x45 Downsampled Grid Tracking.
 * 7. 100% Procedural Web Audio API sound synthesis.
 * 8. 60 FPS RequestAnimationFrame Loop with Smooth Raycast Interactions.
 */

import * as THREE from 'three';
import { soundSynthesizer } from './audio/soundSynthesizer.js';
import {
  initClassroomScene,
  scene,
  camera,
  renderer,
  updateScene,
  renderScene,
  boardMesh,
  teacherDeskMesh,
  whenLoaded,
  onResize,
  dollyZoomToBlackboard,
  resetCameraToClassroom
} from './scene/classroomScene.js';
import {
  initInteractiveBoard,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  boardCanvas,
  boardCtx,
  staticBoardCanvas,
  staticBoardCtx,
  boardTexture,
  staticBoardTexture,
  updateBoard,
  boardState,
  handlePointerEvent,
  raycastToCanvas,
  eraser3D,
  onLaunch,
  onReset,
  onLevelSelect,
  onLetterOpen,
  onParamChange,
  setGameplayRenderer,
  setTelemetry,
  setBoardLevel,
  syncBlackHoleVideo,
  clearStaticBoard
} from './scene/interactiveBoard.js';
import {
  initTeacherDesk,
  openLetter,
  closeLetter,
  isLetterOpen,
  updateEnvelope,
  disposeTeacherDesk
} from './scene/teacherDeskInteract.js';
import { initGameplay } from './physics/gameplayController.js';
import { BlackHoleSupernova } from './physics/blackHoleSupernova.js';
import { EraserController } from './engine/eraserController.js';

// Reusable raycasting objects for 60 FPS zero-allocation performance
const reusableRaycaster = new THREE.Raycaster();
const reusableMouseNdc = new THREE.Vector2();

// =============================================================================
// SYSTEM STATE MACHINE
// =============================================================================
export const APP_STATES = {
  LOADING: 'LOADING',
  IDLE_CLASSROOM: 'IDLE_CLASSROOM',
  LETTER_OPENED: 'LETTER_OPENED',
  LEVEL_1_BALLISTICS: 'LEVEL_1_BALLISTICS',
  LEVEL_2_ORBITAL: 'LEVEL_2_ORBITAL',
  LEVEL_3_BLACKHOLE: 'LEVEL_3_BLACKHOLE',
  SINGULARITY_COLLAPSE: 'SINGULARITY_COLLAPSE',
  SUPERNOVA_CHALK_EXPLOSION: 'SUPERNOVA_CHALK_EXPLOSION',
  ERASER_WIPING: 'ERASER_WIPING',
  PHASE_2_READY: 'PHASE_2_READY'
};

class ClassroomApp {
  constructor() {
    this.state = APP_STATES.IDLE_CLASSROOM;
    this.lastTime = performance.now();
    this.isAudioMuted = false;
    this.isPointerDown = false;
    this.is3DPaused = false;

    // DOM Elements
    this.dom = {
      canvas: document.getElementById('webgl-canvas'),
      letterModal: document.getElementById('letter-modal'),
      closeLetterBtn: document.getElementById('close-letter-btn'),
      btnStartBoard: document.getElementById('btn-start-chalkboard'),
      audioToggleBtn: document.getElementById('audio-toggle-btn'),
      audioIcon: document.getElementById('audio-icon'),
      skipPhaseBtn: document.getElementById('skip-phase-btn'),
      skipPhaseText: document.getElementById('skip-phase-text'),
      phase2Overlay: document.getElementById('phase2-video-overlay'),
      phase2Video: document.getElementById('phase2-video'),
      btnSkipVideo: document.getElementById('btn-skip-video'),
      endingScreen: document.getElementById('ending-screen'),
      btnEndingReplayVideo: document.getElementById('btn-ending-replay-video'),
      btnEndingLetter: document.getElementById('btn-ending-letter'),
      btnEndingHome: document.getElementById('btn-ending-home'),
      endingBgm: document.getElementById('ending-bgm'),
      btnEndingMusic: document.getElementById('btn-ending-music'),
      endingMusicLabel: document.getElementById('ending-music-label')
    };

    this.endingBgmFadeInterval = null;
    this.isPhase2VideoPlaying = false;

    if (this.dom.endingBgm) {
      this.dom.endingBgm.pause();
      this.dom.endingBgm.currentTime = 0;
    }

    // Subsystem instances
    this.sceneApi = null;
    this.boardApi = null;
    this.gameplay = null;
    this.supernova = null;
    this.eraser = null;

    // Start initialization
    this.init();
  }

  /**
   * Initializes all systems in dependency order.
   */
  async init() {
    console.log('[App] Starting 3D Classroom Physics App Initialization...');

    // 1. Initialize 3D Classroom Scene & GLTF Loader
    try {
      this.sceneApi = initClassroomScene({
        canvas: this.dom.canvas
      });
    } catch (err) {
      console.warn('[App] WebGL initialization fallback:', err);
    }

    // 2. Wait for 3D model, blackboard, and teacher desk identification
    try {
      const loadedData = await whenLoaded;
      console.log('[App] 3D Assets loaded successfully:', loadedData);
    } catch (err) {
      console.error('[App] Failed to load classroom GLTF asset:', err);
    }

    // 3. Initialize Interactive Blackboard (2048x820 CanvasTexture on boardMesh)
    this.boardApi = initInteractiveBoard({
      scene,
      camera,
      boardMesh,
      renderer
    });

    // 4. Initialize Teacher Desk Vintage Kraft Envelope & Wax Seal Interaction
    try {
      initTeacherDesk(scene, camera, teacherDeskMesh, { domElement: this.dom.canvas });
    } catch (err) {
      console.warn('[App] Teacher desk initialization warning:', err);
    }

    // 5. Initialize Eraser Controller (erases directly on staticBoardCanvas)
    this.eraser = new EraserController({
      boardWidth: CANVAS_WIDTH,
      boardHeight: CANVAS_HEIGHT,
      staticCanvas: staticBoardCanvas,
      staticCtx: staticBoardCtx,
      boardTexture: staticBoardTexture || boardTexture,
      eraser3D,
      onPhase1Completed: () => this.handlePhase1Completed()
    });

    // 6. Initialize Black Hole Supernova Sequence (bakes directly onto staticBoardCtx)
    this.supernova = new BlackHoleSupernova({
      boardWidth: CANVAS_WIDTH,
      boardHeight: CANVAS_HEIGHT,
      staticCtx: staticBoardCtx,
      boardTexture: staticBoardTexture || boardTexture,
      eraserController: this.eraser,
      onComplete: () => this.handleSupernovaComplete()
    });

    // 7. Initialize Gameplay Controller & RK4 Physics
    this.gameplay = initGameplay(CANVAS_WIDTH, CANVAS_HEIGHT, {
      onLevelVictory: (lvl) => this.handleLevelVictory(lvl),
      onBlackHoleSingularity: (bhPos) => this.handleBlackHoleSingularity(bhPos),
      onTelemetryUpdate: (telemetry) => setTelemetry(telemetry)
    });

    // 8. Connect Diegetic Board Actions to Gameplay & Scene
    this.bindBoardActions();

    // 9. Register Dynamic Gameplay Renderer into Interactive Board
    setGameplayRenderer((ctx, width, height) => this.renderDynamicOverlay(ctx, width, height));

    // 10. Bind User Input (Mouse, Touch, Keyboard, Audio)
    this.bindDOMEvents();

    // 11. Initial Level Sync
    this.setLevel(1);

    this.state = APP_STATES.IDLE_CLASSROOM;

    // 12. Start 60 FPS Animation & Physics Loop
    requestAnimationFrame((t) => this.mainLoop(t));
    console.log('[App] 3D Classroom Physics App Ready.');
  }

  /**
   * Connects diegetic chalkboard UI event dispatches to gameplay logic.
   */
  bindBoardActions() {
    // Launch Chalk Projectile
    onLaunch(({ angle, velocity }) => {
      if (this.state === APP_STATES.SINGULARITY_COLLAPSE ||
          this.state === APP_STATES.SUPERNOVA_CHALK_EXPLOSION ||
          this.state === APP_STATES.ERASER_WIPING) {
        return;
      }
      this.gameplay.fireProjectile(angle, velocity);
    });

    // Reset Level
    onReset(() => {
      if (this.state === APP_STATES.SINGULARITY_COLLAPSE ||
          this.state === APP_STATES.SUPERNOVA_CHALK_EXPLOSION) {
        return;
      }
      if (this.state === APP_STATES.ERASER_WIPING) {
        this.eraser.resetGrid();
      }
      this.gameplay.resetLevel();
      updateBoard();
    });

    // Level Tab Click
    onLevelSelect((lvl) => {
      if (this.state === APP_STATES.SINGULARITY_COLLAPSE ||
          this.state === APP_STATES.SUPERNOVA_CHALK_EXPLOSION) {
        return;
      }
      this.setLevel(lvl);
    });

    // Tribute Letter Button Click
    onLetterOpen(() => {
      this.openTributeLetter();
    });

    // Angle / Speed Slider adjustment
    onParamChange(({ angle, velocity }) => {
      if (this.gameplay) {
        this.gameplay.angleDeg = angle;
        this.gameplay.v0 = velocity;
        this.gameplay.updateTelemetry();
      }
    });
  }

  /**
   * Changes the active simulation level and synchronizes state machine.
   */
  setLevel(levelIndex) {
    if (this.gameplay) {
      this.gameplay.setLevel(levelIndex);
    }
    setBoardLevel(levelIndex);
    boardState.isBoardCleaned = false;
    boardState.hideProtractor = false;
    if (this.eraser) {
      this.eraser.isActive = false;
      this.eraser.hasTriggeredCompletion = false;
      this.eraser.dock();
      this.eraser.resetGrid();
    }
    clearStaticBoard();
    if (levelIndex === 1) this.state = APP_STATES.LEVEL_1_BALLISTICS;
    else if (levelIndex === 2) this.state = APP_STATES.LEVEL_2_ORBITAL;
    else if (levelIndex === 3) this.state = APP_STATES.LEVEL_3_BLACKHOLE;
    updateBoard();
    this.updateSkipButtonText();
  }

  /**
   * Binds DOM listeners for pointer raycasting, modals, keyboard, and audio controls.
   */
  bindDOMEvents() {
    const canvas = this.dom.canvas;
    if (!canvas) return;

    // Pointer Interaction (Canvas Raycasting)
    const onPointerEvent = (e, type) => {
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

      if (type === 'pointerdown') {
        this.isPointerDown = true;
        // Lazy initialize Web Audio API on first interaction
        soundSynthesizer.init();
      } else if (type === 'pointerup') {
        this.isPointerDown = false;
      }

      // 1. Raycast cursor against 3D Blackboard writing plane
      const boardHit = raycastToCanvas(clientX, clientY, camera);

      // A. Eraser wiping mode active
      if (this.eraser && this.eraser.isActive) {
        if (type === 'pointerdown' && !boardHit.hit && eraser3D) {
          reusableMouseNdc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
          reusableRaycaster.setFromCamera(reusableMouseNdc, camera);
          const hits = reusableRaycaster.intersectObject(eraser3D, true);
          if (hits.length > 0) {
            this.eraser.handlePointer('pointerdown', this.eraser.dockPos.x, this.eraser.dockPos.y);
            document.body.style.cursor = 'grabbing';
            return;
          }
        }

        if (this.eraser.isDragging) {
          this.eraser.handlePointer(type, boardHit.x, boardHit.y);
          document.body.style.cursor = this.isPointerDown ? 'grabbing' : 'grab';
          return;
        }

        if (boardHit.hit) {
          this.eraser.handlePointer(type, boardHit.x, boardHit.y);
          document.body.style.cursor = this.isPointerDown ? 'grabbing' : 'grab';
          return;
        }
        return;
      }

      if (boardHit.hit) {
        // B. Supernova explosion active (block normal interaction)
        if (this.supernova && this.supernova.isActive()) {
          return;
        }

        // C. Standard Diegetic Chalkboard UI Interaction
        const consumed = handlePointerEvent(type, boardHit.x, boardHit.y, this.isPointerDown, e);
        if (consumed) {
          document.body.style.cursor = 'pointer';
        } else {
          document.body.style.cursor = 'crosshair';
        }
      } else {
        // Chuột nằm ngoài vùng viết phấn của bảng đen:
        // TUYỆT ĐỐI KHÔNG cho pointerdown chạy nhánh isDraggingGunnyAim để phóng phấn.
        // CHỈ forward pointermove / pointerup nếu trước đó đã bắt đầu drag TỪ BÊN TRONG bảng đen!
        if (boardState.isDraggingGunnyAim || boardState.isDraggingSlider || boardState.isDraggingProtractor) {
          handlePointerEvent(type, boardHit.x, boardHit.y, this.isPointerDown, e);
        }
      }
    };

    canvas.addEventListener('pointermove', (e) => onPointerEvent(e, 'pointermove'), { passive: true });
    canvas.addEventListener('pointerdown', (e) => onPointerEvent(e, 'pointerdown'));
    canvas.addEventListener('pointerup', (e) => onPointerEvent(e, 'pointerup'));
    canvas.addEventListener('click', (e) => onPointerEvent(e, 'click'));

    // Global pointerup & pointercancel to prevent stuck drag/aim states when releasing off-canvas
    const onGlobalPointerUp = (e) => {
      if (!this.isPointerDown && !boardState.isDraggingGunnyAim && !boardState.isDraggingSlider && !boardState.isDraggingProtractor && !(this.eraser && this.eraser.isActive)) {
        return;
      }
      this.isPointerDown = false;
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const boardHit = raycastToCanvas(clientX, clientY, camera);
      if (this.eraser && this.eraser.isActive) {
        this.eraser.handlePointer('pointerup', boardHit.x, boardHit.y);
      }
      if (boardState.isDraggingGunnyAim || boardState.isDraggingSlider || boardState.isDraggingProtractor) {
        handlePointerEvent('pointerup', boardHit.x, boardHit.y, false, e);
      }
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.cursor = 'default';
      }
    };

    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('pointercancel', onGlobalPointerUp);

    // Keyboard Shortcuts: Gunny PC Controls (↑/↓ / W/S to adjust 1° angle, Space to charge & release power)
    window.addEventListener('keydown', (e) => {
      // Lazy init audio
      soundSynthesizer.init();

      // Ignore inputs if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (this.gameplay && !this.supernova?.isActive() && !this.eraser?.isActive) {
          const newAngle = Math.min(85, Math.round(this.gameplay.angleDeg + 1));
          this.gameplay.angleDeg = newAngle;
          boardState.angle = newAngle;
          this.gameplay.updateTelemetry();
          try {
            if (soundSynthesizer && typeof soundSynthesizer.playChalkStroke === 'function') {
              soundSynthesizer.playChalkStroke(0.18, 0.4, 0.04);
            }
          } catch {}
          updateBoard();
        }
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        if (this.gameplay && !this.supernova?.isActive() && !this.eraser?.isActive) {
          const newAngle = Math.max(10, Math.round(this.gameplay.angleDeg - 1));
          this.gameplay.angleDeg = newAngle;
          boardState.angle = newAngle;
          this.gameplay.updateTelemetry();
          try {
            if (soundSynthesizer && typeof soundSynthesizer.playChalkStroke === 'function') {
              soundSynthesizer.playChalkStroke(0.18, 0.4, 0.04);
            }
          } catch {}
          updateBoard();
        }
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (this.gameplay && !this.supernova?.isActive() && !this.eraser?.isActive) {
          if (!e.repeat) {
            this.gameplay.startPowerCharge();
            updateBoard();
          }
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (this.gameplay) this.gameplay.resetLevel();
        if (this.eraser && this.eraser.isActive) this.eraser.resetGrid();
        updateBoard();
      } else if (e.key === '1') {
        this.setLevel(1);
      } else if (e.key === '2') {
        this.setLevel(2);
      } else if (e.key === '3') {
        this.setLevel(3);
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        this.skipToPhase3();
      } else if (e.key === 'm' || e.key === 'M') {
        this.toggleAudio();
      } else if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    // Space keyup: Release power charge to shoot at that exact power
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.gameplay && this.gameplay.isChargingPower) {
          this.gameplay.releasePowerCharge();
          boardState.velocity = this.gameplay.v0;
          updateBoard();
        }
      }
    });

    // Window Resize
    window.addEventListener('resize', () => {
      if (typeof onResize === 'function') onResize();
    });

    // Letter Modal Actions
    if (this.dom.closeLetterBtn) {
      this.dom.closeLetterBtn.addEventListener('click', () => closeLetter());
    }
    if (this.dom.btnStartBoard) {
      this.dom.btnStartBoard.addEventListener('click', () => {
        closeLetter();
        soundSynthesizer.init();
        this.setLevel(1);
      });
    }

    // Phase 2 Video Overlay Actions
    if (this.dom.btnSkipVideo) {
      this.dom.btnSkipVideo.addEventListener('click', () => {
        if (this.dom.phase2Video) {
          this.dom.phase2Video.pause();
        }
        this.showEndingScreen();
      });
    }
    if (this.dom.phase2Video) {
      this.dom.phase2Video.addEventListener('ended', () => {
        if (!this.isPhase2VideoPlaying) return;
        this.showEndingScreen();
      });
    }

    // Ending Screen Actions
    if (this.dom.btnEndingReplayVideo) {
      this.dom.btnEndingReplayVideo.addEventListener('click', () => {
        if (this.dom.endingScreen) this.dom.endingScreen.classList.remove('active');
        this.startPhase2Video();
      });
    }
    if (this.dom.btnEndingLetter) {
      this.dom.btnEndingLetter.addEventListener('click', () => {
        this.openTributeLetter();
      });
    }
    if (this.dom.btnEndingHome) {
      this.dom.btnEndingHome.addEventListener('click', () => {
        this.returnToMainClassroom();
      });
    }

    // Ending BGM Pill Toggle
    if (this.dom.btnEndingMusic) {
      this.dom.btnEndingMusic.addEventListener('click', () => {
        if (!this.dom.endingBgm) return;
        if (this.dom.endingBgm.paused) {
          this.dom.endingBgm.volume = 0.55;
          this.dom.endingBgm.play().catch(() => {});
          if (this.dom.endingMusicLabel) this.dom.endingMusicLabel.textContent = 'lit(var)';
        } else {
          this.dom.endingBgm.pause();
          if (this.dom.endingMusicLabel) this.dom.endingMusicLabel.textContent = 'Đã tắt nhạc';
        }
      });
    }

    // Audio Toggle Button
    if (this.dom.audioToggleBtn) {
      this.dom.audioToggleBtn.addEventListener('click', () => this.toggleAudio());
    }

    // Skip to Phase 3 / Trigger Black Hole Fast Button
    if (this.dom.skipPhaseBtn) {
      this.dom.skipPhaseBtn.addEventListener('click', () => {
        soundSynthesizer.init();
        this.skipToPhase3();
      });
    }
  }

  /**
   * Opens tribute letter modal and updates state.
   */
  openTributeLetter() {
    this.state = APP_STATES.LETTER_OPENED;
    openLetter();
  }

  /**
   * Closes all active modal dialogs.
   */
  closeAllModals() {
    closeLetter();
  }

  /**
   * Toggles audio mute state.
   */
  toggleAudio() {
    this.isAudioMuted = !this.isAudioMuted;
    if (soundSynthesizer) {
      if (typeof soundSynthesizer.setMuted === 'function') {
        soundSynthesizer.setMuted(this.isAudioMuted);
      } else if (typeof soundSynthesizer.toggleMute === 'function') {
        soundSynthesizer.toggleMute();
      }
    }
    if (this.dom.phase2Video) {
      this.dom.phase2Video.muted = this.isAudioMuted;
    }
    if (this.dom.endingBgm) {
      this.dom.endingBgm.muted = this.isAudioMuted;
    }
    if (this.dom.audioIcon) {
      this.dom.audioIcon.textContent = this.isAudioMuted ? '🔇' : '🔊';
    }
  }

  /**
   * Handles Level completion / Target hit.
   */
  handleLevelVictory(level) {
    console.log(`[App] Victory achieved on Level ${level}!`);
    soundSynthesizer.playSuccess();

    // Auto-advance Level 1 -> 2 -> 3 with pleasant delay
    if (level === 1) {
      setTimeout(() => this.setLevel(2), 1600);
    } else if (level === 2) {
      setTimeout(() => this.setLevel(3), 1600);
    }
  }

  /**
   * Handles Level 3 Black Hole Event Horizon Penetration (r <= rs).
   * Initiates Singularity Collapse and Supernova Chalk Detonation.
   */
  handleBlackHoleSingularity(bhPos) {
    console.log('[App] Singularity Triggered at:', bhPos);
    this.state = APP_STATES.SINGULARITY_COLLAPSE;
    boardState.hideProtractor = true;

    if (this.supernova) {
      this.supernova.start(bhPos || { x: 1220, y: 520 });
    }
    this.updateSkipButtonText();
  }

  /**
   * Called when Supernova finish exploding and 88 formulas are baked.
   * Hands over to the 3D Felt Eraser wiping state.
   */
  handleSupernovaComplete() {
    console.log('[App] Supernova completed. Activating Felt Eraser Mode...');
    this.state = APP_STATES.ERASER_WIPING;
    boardState.hideProtractor = true;

    if (this.eraser) {
      this.eraser.activate();
    }
    this.updateSkipButtonText();
  }

  /**
   * Stops ending BGM and clears fade interval immediately.
   */
  stopEndingMusic() {
    if (this.endingBgmFadeInterval) {
      clearInterval(this.endingBgmFadeInterval);
      this.endingBgmFadeInterval = null;
    }
    if (this.dom.endingBgm) {
      this.dom.endingBgm.pause();
      this.dom.endingBgm.currentTime = 0;
      this.dom.endingBgm.volume = 0;
    }
  }

  /**
   * Called when user wipes >= 80% of the chalkboard.
   * Triggers Phase 1 completion and initiates Cinematic Dolly-Zoom + Phase 2 Memorial Video.
   */
  handlePhase1Completed() {
    this.stopEndingMusic();
    console.log('[App] Phase 1 100% Completed! Blackboard sparkling clean.');
    this.state = APP_STATES.PHASE_2_READY;
    this.updateSkipButtonText();

    // Ensure blackboard is 100% sparkling clean with zero UI/props
    boardState.isBoardCleaned = true;
    boardState.hideProtractor = true;
    clearStaticBoard();
    syncBlackHoleVideo({ visible: false });
    updateBoard();

    // Global custom event for Phase 2 integration
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('phase1-completed', {
        detail: {
          timestamp: Date.now(),
          cleanedPercentage: 100
        }
      }));
    }

    // Smooth Dolly-Zoom to Blackboard, then play Memorial Video
    console.log('[App] Initiating Camera Dolly-Zoom onto Blackboard...');
    dollyZoomToBlackboard(1.6, () => {
      console.log('[App] Dolly-zoom finished. Launching Phase 2 Memorial Video...');
      this.startPhase2Video();
    });
  }

  /**
   * Starts full-screen Phase 2 Memorial Video and pauses 3D loop for 60 FPS video smoothness.
   */
  startPhase2Video() {
    this.stopEndingMusic();
    this.isPhase2VideoPlaying = true;

    if (this.dom.endingScreen) {
      this.dom.endingScreen.classList.remove('active');
    }
    if (this.dom.phase2Overlay && this.dom.phase2Video) {
      this.dom.phase2Overlay.classList.add('active');
      this.dom.phase2Video.currentTime = 0;
      this.dom.phase2Video.muted = this.isAudioMuted;
      this.dom.phase2Video.play().catch(() => {
        // Fallback: If autoplay with sound is blocked, mute and play
        if (this.dom.phase2Video) {
          this.dom.phase2Video.muted = true;
          this.dom.phase2Video.play().catch(() => {});
        }
      });
      this.is3DPaused = true;
    }
  }

  /**
   * Displays Phase 3 Lightweight Ending Screen.
   */
  showEndingScreen() {
    this.isPhase2VideoPlaying = false;
    if (this.dom.phase2Video) {
      this.dom.phase2Video.pause();
    }
    if (this.dom.phase2Overlay) {
      this.dom.phase2Overlay.classList.remove('active');
    }
    if (this.dom.endingScreen) {
      this.dom.endingScreen.classList.add('active');
    }
    this.is3DPaused = true;

    // Play ending background music with gentle fade-in from 0 to 0.55 over ~2 seconds
    this.stopEndingMusic();
    if (this.dom.endingBgm) {
      if (!this.isAudioMuted) {
        this.dom.endingBgm.muted = false;
        this.dom.endingBgm.currentTime = 0;
        this.dom.endingBgm.volume = 0;
        this.dom.endingBgm.play().catch(() => {});
        if (this.dom.endingMusicLabel) {
          this.dom.endingMusicLabel.textContent = 'lit(var)';
        }
        let curVol = 0;
        const targetVol = 0.55;
        const step = targetVol / (2000 / 50); // 40 steps over 2000ms
        this.endingBgmFadeInterval = setInterval(() => {
          curVol = Math.min(targetVol, curVol + step);
          if (this.dom.endingBgm) {
            this.dom.endingBgm.volume = curVol;
          }
          if (curVol >= targetVol) {
            clearInterval(this.endingBgmFadeInterval);
            this.endingBgmFadeInterval = null;
          }
        }, 50);
      } else {
        this.dom.endingBgm.muted = true;
      }
    }
  }

  /**
   * Returns camera and state back to classroom from Ending Screen.
   */
  returnToMainClassroom() {
    this.stopEndingMusic();
    this.isPhase2VideoPlaying = false;

    if (this.dom.phase2Video) {
      this.dom.phase2Video.pause();
    }
    if (this.dom.phase2Overlay) {
      this.dom.phase2Overlay.classList.remove('active');
    }
    if (this.dom.endingScreen) {
      this.dom.endingScreen.classList.remove('active');
    }
    this.is3DPaused = false;
    boardState.isBoardCleaned = false;
    boardState.hideProtractor = false;
    if (this.eraser) {
      this.eraser.hasTriggeredCompletion = false;
      this.eraser.isActive = false;
      this.eraser.resetGrid();
    }
    console.log('[App] Returning camera and state back to classroom...');
    resetCameraToClassroom();
    this.setLevel(1);
  }

  /**
   * Fast Phase 3 / Black Hole skip helper:
   * - If not at Level 3: directly jumps to Level 3 (Schwarzschild Black Hole).
   * - If already at Level 3: directly triggers Black Hole Singularity Collapse & Supernova!
   * - If currently in Supernova or Eraser mode: completes wiping and launches Video!
   */
  skipToPhase3() {
    this.closeAllModals();

    // 1. If currently in Video Overlay, skip directly to Ending Screen
    if (this.dom.phase2Overlay && this.dom.phase2Overlay.classList.contains('active')) {
      this.showEndingScreen();
      return;
    }

    // 2. If currently in Eraser mode, immediately complete wiping and launch Dolly-Zoom + Video!
    if (this.eraser && this.eraser.isActive) {
      this.eraser.finishWiping();
      return;
    }

    // 3. If currently in Supernova sequence, finish bake immediately and launch Video!
    if (this.supernova && this.supernova.isActive()) {
      this.supernova.finalizeBake();
      if (this.eraser) {
        this.eraser.finishWiping();
      }
      return;
    }

    // 4. If not at Level 3, jump straight to Level 3
    if (!this.gameplay || this.gameplay.currentLevel !== 3) {
      this.setLevel(3);
      return;
    }

    // 5. If already at Level 3, immediately trigger Black Hole Singularity!
    if (this.gameplay && this.gameplay.currentLevel === 3) {
      const bh = this.gameplay.blackHole || { x: 1180, y: 410, rs: 62 };
      this.handleBlackHoleSingularity(bh);
    }
  }

  /**
   * Updates text on the skip phase button dynamically.
   */
  updateSkipButtonText() {
    if (!this.dom.skipPhaseText) return;
    if (this.dom.phase2Overlay?.classList.contains('active')) {
      this.dom.skipPhaseText.textContent = 'Bỏ qua Video';
    } else if (this.eraser?.isActive || this.supernova?.isActive()) {
      this.dom.skipPhaseText.textContent = 'Lau Bảng & Xem Video';
    } else if (this.gameplay?.currentLevel === 3) {
      this.dom.skipPhaseText.textContent = 'Kích Hoạt Hố Đen Nổ';
    } else {
      this.dom.skipPhaseText.textContent = 'Đến Màn 3 (Hố Đen)';
    }
  }

  /**
   * Dynamic Canvas Overlay Renderer.
   * Injected into updateBoard() to draw active simulation layers:
   * (1) Projectile, trajectory, dust trails, field vectors
   * (2) Singularity fragments and supernova particles
   * (3) Falling eraser crumbs and felt footprint
   */
  renderDynamicOverlay(ctx, width, height) {
    if (!ctx) return;

    // If board is cleaned / ready for phase 2 or beyond: DO NOT DRAW ANYTHING on the blackboard!
    if (this.state === APP_STATES.PHASE_2_READY || this.eraser?.hasTriggeredCompletion || boardState.isBoardCleaned) {
      return;
    }

    // 1. Supernova & Singularity Sequence
    if (this.supernova && this.supernova.isActive()) {
      this.supernova.draw(ctx);
      return;
    }

    // 2. Felt Eraser Wiping Mode
    if (this.eraser && this.eraser.isActive) {
      this.eraser.draw(ctx);
      return;
    }

    // 3. Normal Gameplay Physics (Bullets, dashed trails, targets, celestial bodies)
    if (this.gameplay) {
      this.gameplay.draw(ctx);
    }
  }

  /**
   * Main 60 FPS Animation & Simulation Loop.
   */
  mainLoop(currentTime) {
    requestAnimationFrame((t) => this.mainLoop(t));

    if (this.is3DPaused) {
      this.lastTime = currentTime;
      return;
    }

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    // 1. Update 3D Teacher Desk Envelope kinematics & aura
    try {
      updateEnvelope(dt);
    } catch {
      // Ignore during initial frame
    }

    // 2. Update Active Physics / Animation Subsystem
    if (this.supernova && this.supernova.isActive()) {
      this.supernova.update(dt);
      updateBoard();
    } else if (this.eraser && this.eraser.isActive) {
      this.eraser.update(dt);
      if (this.eraser.isDragging || this.eraser.crumbs.length > 0 || this.eraser.autoCleaning) {
        updateBoard();
      }
    } else if (this.gameplay) {
      if (this.gameplay.isChargingPower) {
        this.gameplay.updatePowerCharge(dt);
        boardState.velocity = this.gameplay.v0;
        updateBoard();
      }
      this.gameplay.updatePhysics(dt);
      // Redraw board if projectile, power charging, sparks, or dust particles are active, or right when they finish
      const isSimulating = Boolean(
        this.gameplay.bullet ||
        this.gameplay.isChargingPower ||
        (this.gameplay.dustParticles && this.gameplay.dustParticles.length > 0) ||
        (this.gameplay.sparkParticles && this.gameplay.sparkParticles.length > 0)
      );
      if (isSimulating || this._lastSimulating) {
        updateBoard();
      }
      this._lastSimulating = isSimulating;
    }

    // 2.5 Sync 3D Black Hole Video Accretion Disk
    if (
      this.state === APP_STATES.PHASE_2_READY ||
      this.eraser?.hasTriggeredCompletion ||
      boardState.isBoardCleaned
    ) {
      syncBlackHoleVideo({ visible: false });
    } else if (this.supernova && this.supernova.state === 'IMPLODING') {
      syncBlackHoleVideo({
        visible: true,
        canvasX: this.supernova.blackHolePos.x,
        canvasY: this.supernova.blackHolePos.y,
        radiusPx: this.supernova.bhRadius
      });
    } else if (
      this.gameplay &&
      this.gameplay.currentLevel === 3 &&
      this.gameplay.blackHole &&
      (!this.supernova || this.supernova.state === 'IDLE') &&
      (!this.eraser || !this.eraser.isActive) &&
      this.state !== APP_STATES.ERASER_WIPING &&
      this.state !== APP_STATES.PHASE_2_READY
    ) {
      syncBlackHoleVideo({
        visible: true,
        canvasX: this.gameplay.blackHole.x,
        canvasY: this.gameplay.blackHole.y,
        radiusPx: this.gameplay.blackHole.rs
      });
    } else {
      syncBlackHoleVideo({ visible: false });
    }

    // 3. Update & Render Three.js 3D Scene (supports EffectComposer bloom + film grain, or fallback)
    updateScene(dt, currentTime / 1000.0);
    renderScene(currentTime / 1000.0);
  }

  /**
   * Cleans up scene resources, timers, and desk interactive meshes.
   */
  dispose() {
    try {
      disposeTeacherDesk();
    } catch (e) {
      console.warn('[App] Desk disposal warning:', e);
    }
  }
}

// =============================================================================
// BOOTSTRAP APPLICATION
// =============================================================================
let appInstance = null;

if (typeof window !== 'undefined') {
  const bootstrap = () => {
    if (!appInstance) {
      appInstance = new ClassroomApp();
      window.__CLASSROOM_APP__ = appInstance;
    }
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  window.addEventListener('beforeunload', () => {
    if (appInstance && typeof appInstance.dispose === 'function') {
      appInstance.dispose();
    }
  });
}

export default ClassroomApp;
