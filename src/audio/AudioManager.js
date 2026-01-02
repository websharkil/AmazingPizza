import { GameState } from "../state.js";

// Lightweight global audio controller.
export class AudioManager {
  // Attach the current scene's sound manager.
  static init(scene) {
    this.scene = scene;
    if (!this.sound && scene && scene.sound) {
      this.sound = scene.sound;
    }
  }

  // Play a one-shot sound effect.
  static playSfx(key, config = {}) {
    if (!this.isSfxEnabled()) {
      return;
    }
    const sound = this.getSoundManager();
    if (!sound || !this.isKeyLoaded(key)) {
      return;
    }
    const { duration, ...playConfig } = config;
    const instance = sound.add(key, { loop: false, volume: this.getSfxVolume() });
    instance.play({ volume: this.getSfxVolume(), ...playConfig });
    const cleanup = () => {
      instance.destroy();
    };
    instance.once("complete", cleanup);
    instance.once("stop", cleanup);
    if (typeof duration === "number") {
      const ms = Math.max(0, duration * 1000);
      if (this.scene && this.scene.time) {
        this.scene.time.delayedCall(ms, () => {
          if (instance.isPlaying) {
            instance.stop();
          }
        });
      } else {
        setTimeout(() => {
          if (instance.isPlaying) {
            instance.stop();
          }
        }, ms);
      }
    }
  }

  // Start or switch looping background music.
  static playMusic(key, config = {}) {
    const sound = this.getSoundManager();
    if (!sound || !this.isKeyLoaded(key)) {
      return;
    }
    if (this.musicSound && this.musicKey === key) {
      if (!this.musicSound.isPlaying) {
        this.musicSound.play();
      }
      return;
    }
    this.stopMusic();
    this.musicKey = key;
    this.musicSound = sound.add(key, {
      loop: true,
      volume: this.getMusicVolume(),
      ...config,
    });
    if (this.isMusicEnabled()) {
      this.musicSound.play();
    }
  }

  // Stop the current background music.
  static stopMusic() {
    if (this.musicSound) {
      this.musicSound.stop();
      this.musicSound.destroy();
      this.musicSound = null;
      this.musicKey = null;
    }
  }

  // Enable or disable music playback.
  static setMusicEnabled(enabled) {
    if (!GameState.audio) {
      GameState.audio = {};
    }
    GameState.audio.musicEnabled = Boolean(enabled);
    if (this.musicSound) {
      if (enabled) {
        if (!this.musicSound.isPlaying) {
          this.musicSound.play();
        }
        this.musicSound.setMute(false);
      } else {
        this.musicSound.setMute(true);
      }
    }
  }

  // Enable or disable sound effects.
  static setSfxEnabled(enabled) {
    if (!GameState.audio) {
      GameState.audio = {};
    }
    GameState.audio.sfxEnabled = Boolean(enabled);
  }

  // Set the global music volume.
  static setMusicVolume(value) {
    if (!GameState.audio) {
      GameState.audio = {};
    }
    GameState.audio.musicVolume = Phaser.Math.Clamp(value, 0, 1);
    if (this.musicSound) {
      this.musicSound.setVolume(this.getMusicVolume());
    }
  }

  // Set the global SFX volume.
  static setSfxVolume(value) {
    if (!GameState.audio) {
      GameState.audio = {};
    }
    GameState.audio.sfxVolume = Phaser.Math.Clamp(value, 0, 1);
  }

  // Read music enable state.
  static isMusicEnabled() {
    return GameState.audio ? GameState.audio.musicEnabled !== false : true;
  }

  // Read SFX enable state.
  static isSfxEnabled() {
    return GameState.audio ? GameState.audio.sfxEnabled !== false : true;
  }

  // Read music volume with fallback.
  static getMusicVolume() {
    return GameState.audio && typeof GameState.audio.musicVolume === "number"
      ? GameState.audio.musicVolume
      : 1;
  }

  // Read SFX volume with fallback.
  static getSfxVolume() {
    return GameState.audio && typeof GameState.audio.sfxVolume === "number"
      ? GameState.audio.sfxVolume
      : 1;
  }

  // Get the active Phaser sound manager.
  static getSoundManager() {
    if (this.scene && this.scene.sound) {
      return this.scene.sound;
    }
    return this.sound || null;
  }

  // Check whether an audio key is loaded in the cache.
  static isKeyLoaded(key) {
    if (this.scene && this.scene.cache && this.scene.cache.audio) {
      return this.scene.cache.audio.exists(key);
    }
    return true;
  }
}
