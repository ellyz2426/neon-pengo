import { createSystem, World } from '@iwsdk/core';
import { gameState } from './game-system';
import { GamePhase } from './game-state';

export class AudioSystem extends createSystem({}) {
	private ctx: AudioContext | null = null;
	private musicOsc: OscillatorNode | null = null;
	private musicGain: GainNode | null = null;
	private initialized = false;

	init() {
		if (typeof window !== 'undefined') {
			const start = () => {
				if (!this.initialized) { this.ctx = new AudioContext(); this.initialized = true; this.startMusic(); }
			};
			document.addEventListener('click', start, { once: true });
			document.addEventListener('keydown', start, { once: true });
		}
	}

	private startMusic() {
		if (!this.ctx) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sine';
		osc.frequency.value = 110;
		gain.gain.value = 0.03;
		osc.connect(gain);
		gain.connect(this.ctx.destination);
		osc.start();
		this.musicOsc = osc;
		this.musicGain = gain;
	}

	playSfx(type: string) {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.connect(gain);
		gain.connect(this.ctx.destination);
		switch (type) {
			case 'move': osc.type = 'square'; osc.frequency.value = 220; gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05); osc.stop(now + 0.05); break;
			case 'push': osc.type = 'sawtooth'; osc.frequency.value = 150; gain.gain.setValueAtTime(0.12, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15); osc.stop(now + 0.15); break;
			case 'crush': osc.type = 'square'; osc.frequency.value = 400; gain.gain.setValueAtTime(0.15, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.2); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25); osc.stop(now + 0.25); break;
			case 'stun': osc.type = 'triangle'; osc.frequency.value = 500; gain.gain.setValueAtTime(0.1, now); osc.frequency.exponentialRampToValueAtTime(200, now + 0.3); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3); osc.stop(now + 0.3); break;
			case 'death': osc.type = 'sawtooth'; osc.frequency.value = 300; gain.gain.setValueAtTime(0.15, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.5); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5); osc.stop(now + 0.5); break;
			case 'diamond': osc.type = 'sine'; osc.frequency.value = 800; gain.gain.setValueAtTime(0.12, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4); osc.stop(now + 0.4); break;
			case 'wave': osc.type = 'sine'; osc.frequency.value = 440; gain.gain.setValueAtTime(0.1, now); osc.frequency.exponentialRampToValueAtTime(880, now + 0.3); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5); osc.stop(now + 0.5); break;
			case 'gameover': osc.type = 'sawtooth'; osc.frequency.value = 200; gain.gain.setValueAtTime(0.12, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.8); gain.gain.exponentialRampToValueAtTime(0.001, now + 1); osc.stop(now + 1); break;
			case 'achievement': osc.type = 'sine'; osc.frequency.value = 523; gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); osc.stop(now + 0.5);
				const o2 = this.ctx.createOscillator(); const g2 = this.ctx.createGain(); o2.connect(g2); g2.connect(this.ctx.destination); o2.type = 'sine'; o2.frequency.value = 659; g2.gain.setValueAtTime(0.1, now + 0.1); g2.gain.exponentialRampToValueAtTime(0.001, now + 0.3); o2.start(now + 0.1); o2.stop(now + 0.3);
				const o3 = this.ctx.createOscillator(); const g3 = this.ctx.createGain(); o3.connect(g3); g3.connect(this.ctx.destination); o3.type = 'sine'; o3.frequency.value = 784; g3.gain.setValueAtTime(0.1, now + 0.2); g3.gain.exponentialRampToValueAtTime(0.001, now + 0.5); o3.start(now + 0.2); o3.stop(now + 0.5); break;
			case 'break': osc.type = 'square'; osc.frequency.value = 100; gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); osc.stop(now + 0.1); break;
			default: osc.type = 'sine'; osc.frequency.value = 330; gain.gain.setValueAtTime(0.06, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); osc.stop(now + 0.1);
		}
		osc.start(now);
	}

	update(delta: number) {
		if (!this.musicGain || !this.musicOsc) return;
		const playing = gameState.phase === GamePhase.PLAYING;
		this.musicGain.gain.value = playing ? 0.03 : 0.01;
		if (playing) {
			const baseFreq = 110 + gameState.wave * 5;
			this.musicOsc.frequency.value = baseFreq + Math.sin(Date.now() * 0.001) * 20;
		}
	}
}
