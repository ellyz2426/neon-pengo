// Neon Pengo VR — Game State
export const COLS = 13;
export const ROWS = 11;
export const CELL_SIZE = 0.8;

export enum CellType { EMPTY = 0, ICE = 1, DIAMOND = 2 }
export enum Direction { UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3 }
export enum EnemyState { HATCHING = 0, ACTIVE = 1, STUNNED = 2, DYING = 3 }
export enum GameMode { ARCADE = 'arcade', SPEED = 'speed', ZEN = 'zen', CHALLENGE = 'challenge' }
export enum Difficulty { NORMAL = 'normal', HARD = 'hard', INSANE = 'insane' }
export enum GamePhase { MENU = 'menu', PLAYING = 'playing', PAUSED = 'paused', RESULTS = 'results', TUTORIAL = 'tutorial' }

export interface EnemyData {
	row: number; col: number;
	state: EnemyState;
	stunTimer: number;
	moveTimer: number;
	hatchTimer: number;
	moveDir: Direction;
	moving: boolean;
	moveProgress: number;
	fromRow: number; fromCol: number;
}

export interface Achievement {
	id: string; name: string; desc: string; unlocked: boolean;
}

export const COLOR_SCHEMES: Record<string, { primary: string; accent: string; bg: string; enemy: string; diamond: string }> = {
	cyan:    { primary: '#00ffff', accent: '#0088aa', bg: '#001122', enemy: '#ff4444', diamond: '#ffdd00' },
	green:   { primary: '#00ff88', accent: '#008844', bg: '#001108', enemy: '#ff6644', diamond: '#ffcc00' },
	magenta: { primary: '#ff44ff', accent: '#880088', bg: '#110011', enemy: '#44ff44', diamond: '#ffaa00' },
	gold:    { primary: '#ffcc00', accent: '#886600', bg: '#111100', enemy: '#ff4488', diamond: '#00ffcc' },
};

const ACH_DEF: [string, string, string][] = [
	['first_crush', 'First Crush', 'Crush your first Sno-Bee'],
	['wave_clear', 'Wave Clear', 'Complete wave 1'],
	['combo_2', 'Double Crush', 'Crush 2 enemies with one push'],
	['combo_3', 'Triple Crush', 'Crush 3 enemies with one push'],
	['diamond_align', 'Diamond Line', 'Align 3 diamond blocks'],
	['wall_stun', 'Wall Slam', 'Stun an enemy with a wall push'],
	['wave_5', 'Veteran', 'Reach wave 5'],
	['wave_10', 'Expert', 'Reach wave 10'],
	['score_1k', 'Scorer', 'Score 1,000 points'],
	['score_5k', 'High Scorer', 'Score 5,000 points'],
	['score_10k', 'Master Scorer', 'Score 10,000 points'],
	['score_25k', 'Legend', 'Score 25,000 points'],
	['crush_10', 'Crusher', 'Crush 10 total Sno-Bees'],
	['crush_50', 'Exterminator', 'Crush 50 total Sno-Bees'],
	['crush_100', 'Ice Master', 'Crush 100 total Sno-Bees'],
	['pushes_100', 'Pusher', 'Push 100 blocks'],
	['pushes_500', 'Block Mover', 'Push 500 blocks'],
	['stun_10', 'Stunner', 'Stun 10 enemies'],
	['no_death_wave', 'Flawless', 'Clear a wave without dying'],
	['speed_clear', 'Speed Demon', 'Clear a wave in under 15s'],
	['games_10', 'Regular', 'Play 10 games'],
	['games_50', 'Dedicated', 'Play 50 games'],
	['diamond_5', 'Gem Collector', 'Align diamonds 5 times'],
	['challenge_win', 'Challenger', 'Win a Challenge mode game'],
	['all_modes', 'All-Rounder', 'Play all 4 game modes'],
];

export class GameState {
	grid: CellType[][] = [];
	playerRow = 5; playerCol = 6;
	playerMoving = false; playerMoveProgress = 0;
	playerFromRow = 5; playerFromCol = 6;
	playerDir: Direction = Direction.UP;
	enemies: EnemyData[] = [];
	score = 0; lives = 3; wave = 1; combo = 0; comboTimer = 0;
	pushCount = 0; totalCrushes = 0; totalStuns = 0; totalDiamondAligns = 0;
	phase: GamePhase = GamePhase.MENU;
	mode: GameMode = GameMode.ARCADE;
	difficulty: Difficulty = Difficulty.NORMAL;
	colorScheme = 'cyan';
	highScore = 0;
	speedTimer = 120; challengeMoves = 100;
	waveStartTime = 0; waveElapsed = 0; noDeathThisWave = true;
	modesPlayed: Set<string> = new Set();
	careerGames = 0; careerCrushes = 0; careerPushes = 0;
	careerWaves = 0; careerStuns = 0; careerDiamondAligns = 0;
	careerBestWave = 0;
	achievements: Achievement[] = ACH_DEF.map(([id, name, desc]) => ({ id, name, desc, unlocked: false }));
	pendingAchievement: Achievement | null = null;
	achievementTimer = 0;
	blockSliding = false;
	slideCol = -1; slideRow = -1;
	slideDir: Direction = Direction.UP;
	slideProgress = 0;
	slideTargetCol = -1; slideTargetRow = -1;
	slideCellType: CellType = CellType.ICE;
	crushedThisPush: number[] = [];

	loadPersistence() {
		try {
			const d = localStorage.getItem('neon-pengo-save');
			if (!d) return;
			const s = JSON.parse(d);
			this.highScore = s.highScore || 0;
			this.careerGames = s.careerGames || 0;
			this.careerCrushes = s.careerCrushes || 0;
			this.careerPushes = s.careerPushes || 0;
			this.careerWaves = s.careerWaves || 0;
			this.careerStuns = s.careerStuns || 0;
			this.careerDiamondAligns = s.careerDiamondAligns || 0;
			this.careerBestWave = s.careerBestWave || 0;
			this.colorScheme = s.colorScheme || 'cyan';
			if (s.achievements) for (const a of this.achievements) if (s.achievements[a.id]) a.unlocked = true;
			if (s.modesPlayed) this.modesPlayed = new Set(s.modesPlayed);
		} catch {}
	}

	savePersistence() {
		try {
			const achMap: Record<string, boolean> = {};
			for (const a of this.achievements) if (a.unlocked) achMap[a.id] = true;
			localStorage.setItem('neon-pengo-save', JSON.stringify({
				highScore: this.highScore, careerGames: this.careerGames, careerCrushes: this.careerCrushes,
				careerPushes: this.careerPushes, careerWaves: this.careerWaves, careerStuns: this.careerStuns,
				careerDiamondAligns: this.careerDiamondAligns, careerBestWave: this.careerBestWave,
				colorScheme: this.colorScheme, achievements: achMap, modesPlayed: [...this.modesPlayed],
			}));
		} catch {}
	}

	tryAchievement(id: string): boolean {
		const a = this.achievements.find(x => x.id === id);
		if (!a || a.unlocked) return false;
		a.unlocked = true;
		this.pendingAchievement = a;
		this.achievementTimer = 3;
		this.savePersistence();
		return true;
	}

	getEnemySpeed(): number {
		const base = this.difficulty === Difficulty.INSANE ? 0.4 : this.difficulty === Difficulty.HARD ? 0.6 : 0.8;
		return Math.max(0.25, base - this.wave * 0.02);
	}

	getEnemyCount(): number {
		const base = this.difficulty === Difficulty.INSANE ? 5 : this.difficulty === Difficulty.HARD ? 4 : 3;
		return Math.min(base + Math.floor(this.wave * 0.5), 8);
	}

	getBlockDensity(): number { return Math.max(0.35, 0.55 - this.wave * 0.01); }

	initGrid() {
		this.grid = [];
		for (let r = 0; r < ROWS; r++) {
			this.grid[r] = [];
			for (let c = 0; c < COLS; c++) this.grid[r][c] = CellType.EMPTY;
		}
		const density = this.getBlockDensity();
		for (let r = 0; r < ROWS; r++)
			for (let c = 0; c < COLS; c++)
				if (Math.random() < density) this.grid[r][c] = CellType.ICE;
		this.playerRow = ROWS - 1; this.playerCol = Math.floor(COLS / 2);
		this.grid[this.playerRow][this.playerCol] = CellType.EMPTY;
		for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
			const nr = this.playerRow + dr, nc = this.playerCol + dc;
			if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) this.grid[nr][nc] = CellType.EMPTY;
		}
		let diamonds = 0;
		const icePos: [number, number][] = [];
		for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.grid[r][c] === CellType.ICE) icePos.push([r, c]);
		while (diamonds < 3 && icePos.length > 0) {
			const idx = Math.floor(Math.random() * icePos.length);
			const [r, c] = icePos.splice(idx, 1)[0];
			this.grid[r][c] = CellType.DIAMOND; diamonds++;
		}
		this.enemies = [];
		const enemyCount = this.getEnemyCount();
		const topIce: [number, number][] = [];
		for (let r = 0; r < Math.floor(ROWS / 2); r++)
			for (let c = 0; c < COLS; c++)
				if (this.grid[r][c] === CellType.ICE) topIce.push([r, c]);
		for (let i = 0; i < enemyCount && topIce.length > 0; i++) {
			const idx = Math.floor(Math.random() * topIce.length);
			const [r, c] = topIce.splice(idx, 1)[0];
			this.grid[r][c] = CellType.EMPTY;
			this.enemies.push({
				row: r, col: c, state: EnemyState.HATCHING,
				stunTimer: 0, moveTimer: 0, hatchTimer: 1.5 + Math.random(),
				moveDir: Direction.DOWN, moving: false, moveProgress: 0,
				fromRow: r, fromCol: c,
			});
		}
	}

	gridToWorld(col: number, row: number): [number, number, number] {
		return [(col - (COLS - 1) / 2) * CELL_SIZE, 0.4, (row - (ROWS - 1) / 2) * CELL_SIZE];
	}

	startGame(mode: GameMode, difficulty: Difficulty) {
		this.mode = mode; this.difficulty = difficulty;
		this.score = 0; this.wave = 1; this.combo = 0; this.comboTimer = 0;
		this.pushCount = 0; this.totalCrushes = 0; this.totalStuns = 0; this.totalDiamondAligns = 0;
		this.noDeathThisWave = true; this.blockSliding = false;
		this.lives = mode === GameMode.ZEN ? 99 : 3;
		this.speedTimer = 120;
		this.challengeMoves = mode === GameMode.CHALLENGE ? 100 : 9999;
		this.phase = GamePhase.PLAYING;
		this.waveStartTime = 0; this.waveElapsed = 0;
		this.careerGames++;
		this.modesPlayed.add(mode);
		this.initGrid();
		this.savePersistence();
		if (this.modesPlayed.size >= 4) this.tryAchievement('all_modes');
		if (this.careerGames >= 10) this.tryAchievement('games_10');
		if (this.careerGames >= 50) this.tryAchievement('games_50');
	}

	endGame() {
		if (this.score > this.highScore) this.highScore = this.score;
		if (this.wave > this.careerBestWave) this.careerBestWave = this.wave;
		this.careerCrushes += this.totalCrushes;
		this.careerPushes += this.pushCount;
		this.careerStuns += this.totalStuns;
		this.careerDiamondAligns += this.totalDiamondAligns;
		this.careerWaves += this.wave - 1;
		this.phase = GamePhase.RESULTS;
		this.savePersistence();
	}
}
