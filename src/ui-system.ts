import { createSystem, PanelUI, PanelDocument, UIKitDocument, UIKit, eq } from '@iwsdk/core';
import { gameState, GameSystem } from './game-system';
import { GamePhase, GameMode, Difficulty, COLOR_SCHEMES } from './game-state';
import { AudioSystem } from './audio-system';

export class UISystem extends createSystem({
	menuPanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/menu.json')] },
	hudPanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/hud.json')] },
	pausePanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/pause.json')] },
	resultsPanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/results.json')] },
	settingsPanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/settings.json')] },
	achievementsPanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/achievements.json')] },
	statsPanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/stats.json')] },
	tutorialPanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/tutorial.json')] },
}) {
	private gameSystem!: GameSystem;
	private audioSystem!: AudioSystem;
	private docs: Record<string, UIKitDocument> = {};
	private lastPhase: GamePhase = GamePhase.MENU;
	private achPage = 0;

	init() {
		this.gameSystem = this.world.getSystem(GameSystem)!;
		this.audioSystem = this.world.getSystem(AudioSystem)!;
		const panels = ['menu', 'hud', 'pause', 'results', 'settings', 'achievements', 'stats', 'tutorial'] as const;
		for (const p of panels) {
			const qName = `${p}Panel` as keyof typeof this.queries;
			this.queries[qName].subscribe('qualify', (entity: any) => {
				const doc = PanelDocument.data.document[entity.index] as UIKitDocument;
				if (doc) { this.docs[p] = doc; this.wirePanel(p, doc); }
			});
		}
	}

	private wirePanel(name: string, doc: UIKitDocument) {
		const btn = (id: string, fn: () => void) => {
			const el = doc.getElementById(id) as UIKit.Text | undefined;
			el?.addEventListener('click', fn);
		};
		switch (name) {
			case 'menu':
				btn('btn-arcade', () => this.startGame(GameMode.ARCADE));
				btn('btn-speed', () => this.startGame(GameMode.SPEED));
				btn('btn-zen', () => this.startGame(GameMode.ZEN));
				btn('btn-challenge', () => this.startGame(GameMode.CHALLENGE));
				btn('btn-settings', () => this.showPanel('settings'));
				btn('btn-achievements', () => this.showPanel('achievements'));
				btn('btn-stats', () => this.showPanel('stats'));
				btn('btn-tutorial', () => this.showPanel('tutorial'));
				break;
			case 'pause':
				btn('btn-resume', () => { gameState.phase = GamePhase.PLAYING; });
				btn('btn-quit', () => { gameState.endGame(); this.gameSystem.onEndGame(); });
				break;
			case 'results':
				btn('btn-retry', () => this.startGame(gameState.mode));
				btn('btn-menu', () => { gameState.phase = GamePhase.MENU; });
				break;
			case 'settings':
				btn('btn-cyan', () => this.setColor('cyan'));
				btn('btn-green', () => this.setColor('green'));
				btn('btn-magenta', () => this.setColor('magenta'));
				btn('btn-gold', () => this.setColor('gold'));
				btn('btn-normal', () => { gameState.difficulty = Difficulty.NORMAL; this.updateSettingsText(); });
				btn('btn-hard', () => { gameState.difficulty = Difficulty.HARD; this.updateSettingsText(); });
				btn('btn-insane', () => { gameState.difficulty = Difficulty.INSANE; this.updateSettingsText(); });
				btn('btn-settings-back', () => this.showPanel('menu'));
				break;
			case 'achievements':
				btn('btn-ach-prev', () => { this.achPage = Math.max(0, this.achPage - 1); this.updateAchievements(); });
				btn('btn-ach-next', () => { this.achPage = Math.min(Math.floor((gameState.achievements.length - 1) / 5), this.achPage + 1); this.updateAchievements(); });
				btn('btn-ach-back', () => this.showPanel('menu'));
				break;
			case 'stats':
				btn('btn-stats-back', () => this.showPanel('menu'));
				break;
			case 'tutorial':
				btn('btn-tutorial-back', () => this.showPanel('menu'));
				break;
		}
	}

	private startGame(mode: GameMode) {
		gameState.startGame(mode, gameState.difficulty);
		this.gameSystem.onStartGame();
		this.audioSystem.playSfx('wave');
	}

	private setColor(scheme: string) {
		gameState.colorScheme = scheme;
		gameState.savePersistence();
		this.gameSystem.rebuildVisuals();
		this.updateSettingsText();
	}

	private showPanel(name: string) {
		if (name === 'menu') gameState.phase = GamePhase.MENU;
		else if (name === 'settings' || name === 'achievements' || name === 'stats' || name === 'tutorial') {
			gameState.phase = name as GamePhase;
		}
	}

	private setText(doc: UIKitDocument, id: string, text: string) {
		(doc.getElementById(id) as UIKit.Text | undefined)?.setProperties({ text });
	}

	private updateSettingsText() {
		const doc = this.docs.settings;
		if (!doc) return;
		this.setText(doc, 'diff-label', 'Difficulty: ' + gameState.difficulty.toUpperCase());
		this.setText(doc, 'color-label', 'Color: ' + gameState.colorScheme.toUpperCase());
	}

	private updateAchievements() {
		const doc = this.docs.achievements;
		if (!doc) return;
		const start = this.achPage * 5;
		for (let i = 0; i < 5; i++) {
			const a = gameState.achievements[start + i];
			const prefix = a ? (a.unlocked ? '[*] ' : '[ ] ') : '';
			const name = a ? a.name : '';
			const desc = a ? a.desc : '';
			this.setText(doc, `ach-name-${i}`, prefix + name);
			this.setText(doc, `ach-desc-${i}`, desc);
		}
		const total = gameState.achievements.filter(a => a.unlocked).length;
		this.setText(doc, 'ach-count', total + '/' + gameState.achievements.length + ' unlocked');
		this.setText(doc, 'ach-page', 'Page ' + (this.achPage + 1) + '/' + (Math.floor((gameState.achievements.length - 1) / 5) + 1));
	}

	update() {
		const gs = gameState;
		const phase = gs.phase;
		// Show/hide panels based on phase
		if (phase !== this.lastPhase) {
			this.lastPhase = phase;
			if (phase === GamePhase.MENU) {
				const doc = this.docs.menu;
				if (doc) this.setText(doc, 'high-score', 'Best: ' + gs.highScore);
			}
			if (phase === GamePhase.RESULTS) {
				const doc = this.docs.results;
				if (doc) {
					this.setText(doc, 'final-score', 'Score: ' + gs.score);
					this.setText(doc, 'final-wave', 'Wave: ' + gs.wave);
					this.setText(doc, 'final-crushes', 'Crushes: ' + gs.totalCrushes);
					const isNew = gs.score >= gs.highScore && gs.score > 0;
					this.setText(doc, 'new-best', isNew ? 'NEW BEST!' : '');
				}
			}
			if ((phase as string) === 'achievements') this.updateAchievements();
			if ((phase as string) === 'settings') this.updateSettingsText();
			if ((phase as string) === 'stats') {
				const doc = this.docs.stats;
				if (doc) {
					this.setText(doc, 'stat-games', 'Games: ' + gs.careerGames);
					this.setText(doc, 'stat-crushes', 'Crushes: ' + gs.careerCrushes);
					this.setText(doc, 'stat-pushes', 'Pushes: ' + gs.careerPushes);
					this.setText(doc, 'stat-waves', 'Waves: ' + gs.careerWaves);
					this.setText(doc, 'stat-stuns', 'Stuns: ' + gs.careerStuns);
					this.setText(doc, 'stat-diamonds', 'Diamond aligns: ' + gs.careerDiamondAligns);
					this.setText(doc, 'stat-best-wave', 'Best wave: ' + gs.careerBestWave);
					this.setText(doc, 'stat-best-score', 'Best score: ' + gs.highScore);
				}
			}
		}
		// Update HUD
		if (phase === GamePhase.PLAYING) {
			const doc = this.docs.hud;
			if (doc) {
				this.setText(doc, 'score', 'Score: ' + gs.score);
				this.setText(doc, 'lives', 'Lives: ' + gs.lives);
				this.setText(doc, 'wave', 'Wave: ' + gs.wave);
				this.setText(doc, 'combo', gs.combo > 1 ? 'Combo x' + gs.combo : '');
				if (gs.mode === GameMode.SPEED) this.setText(doc, 'timer', 'Time: ' + Math.ceil(gs.speedTimer) + 's');
				else if (gs.mode === GameMode.CHALLENGE) this.setText(doc, 'timer', 'Moves: ' + gs.challengeMoves);
				else this.setText(doc, 'timer', '');
			}
		}
		// Achievement notification
		if (gs.pendingAchievement && gs.achievementTimer > 0) {
			const doc = this.docs.hud;
			if (doc) this.setText(doc, 'achievement', 'Achievement: ' + gs.pendingAchievement.name);
		} else {
			const doc = this.docs.hud;
			if (doc) this.setText(doc, 'achievement', '');
		}
	}
}
