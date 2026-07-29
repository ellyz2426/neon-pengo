import { createSystem, InputComponent } from '@iwsdk/core';
import { gameState, GameSystem } from './game-system';
import { Direction, GamePhase } from './game-state';

export class InputSystem extends createSystem({}) {
	private gameSystem!: GameSystem;
	private lastDir: Direction | null = null;
	private moveRepeatTimer = 0;
	private xrMoveTimer = 0;

	init() {
		this.gameSystem = this.world.getSystem(GameSystem) as GameSystem;
		if (typeof document !== 'undefined') {
			document.addEventListener('keydown', (e) => this.handleKeyDown(e.key.toLowerCase()));
			document.addEventListener('keyup', (e) => {
				const dirKeys: Record<string, Direction> = {
					'arrowup': Direction.UP, 'w': Direction.UP,
					'arrowdown': Direction.DOWN, 's': Direction.DOWN,
					'arrowleft': Direction.LEFT, 'a': Direction.LEFT,
					'arrowright': Direction.RIGHT, 'd': Direction.RIGHT,
				};
				if (dirKeys[e.key.toLowerCase()] === this.lastDir) this.lastDir = null;
			});
		}
	}

	private handleKeyDown(key: string) {
		if (gameState.phase === GamePhase.PLAYING) {
			const dirKeys: Record<string, Direction> = {
				'arrowup': Direction.UP, 'w': Direction.UP,
				'arrowdown': Direction.DOWN, 's': Direction.DOWN,
				'arrowleft': Direction.LEFT, 'a': Direction.LEFT,
				'arrowright': Direction.RIGHT, 'd': Direction.RIGHT,
			};
			if (dirKeys[key] !== undefined) {
				this.gameSystem.tryMove(dirKeys[key]);
				this.lastDir = dirKeys[key];
				this.moveRepeatTimer = 0.2;
			}
			if (key === 'escape' || key === 'p') gameState.phase = GamePhase.PAUSED;
		} else if (gameState.phase === GamePhase.PAUSED) {
			if (key === 'escape' || key === 'p') gameState.phase = GamePhase.PLAYING;
		}
	}

	update(delta: number) {
		if (gameState.phase === GamePhase.PLAYING && this.lastDir !== null) {
			this.moveRepeatTimer -= delta;
			if (this.moveRepeatTimer <= 0) {
				this.moveRepeatTimer = 0.1;
				this.gameSystem.tryMove(this.lastDir);
			}
		}
		// XR controller input via action system
		const input = this.world.input;
		if (!input) return;
		try {
			const axes = (input as any).getAxes?.(InputComponent.Thumbstick) || { x: 0, y: 0 };
			this.xrMoveTimer -= delta;
			if (this.xrMoveTimer <= 0) {
				const threshold = 0.5;
				let moved = false;
				if (axes.y < -threshold) { this.gameSystem.tryMove(Direction.UP); moved = true; }
				else if (axes.y > threshold) { this.gameSystem.tryMove(Direction.DOWN); moved = true; }
				else if (axes.x < -threshold) { this.gameSystem.tryMove(Direction.LEFT); moved = true; }
				else if (axes.x > threshold) { this.gameSystem.tryMove(Direction.RIGHT); moved = true; }
				if (moved) this.xrMoveTimer = 0.15;
			}
			if ((input as any).getButtonDown?.(InputComponent.Trigger)) {
				// Additional action placeholder
			}
			if ((input as any).getButtonDown?.('b-button')) {
				if (gameState.phase === GamePhase.PLAYING) gameState.phase = GamePhase.PAUSED;
				else if (gameState.phase === GamePhase.PAUSED) gameState.phase = GamePhase.PLAYING;
			}
		} catch {}
	}
}
