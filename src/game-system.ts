import {
	createSystem, World, BoxGeometry, MeshStandardMaterial, Mesh, Group,
	OctahedronGeometry, SphereGeometry, IcosahedronGeometry, Color,
	EdgesGeometry, LineSegments, LineBasicMaterial, Vector3,
} from '@iwsdk/core';
import {
	GameState, CellType, Direction, EnemyState, EnemyData, GamePhase, GameMode, COLS, ROWS, CELL_SIZE, COLOR_SCHEMES,
} from './game-state';

const PLAYER_MOVE_SPEED = 8;
const BLOCK_SLIDE_SPEED = 12;
const ENEMY_MOVE_SPEED = 5;

export const gameState = new GameState();

export class GameSystem extends createSystem({}) {
	private blockGroup!: Group;
	private blockMeshes: Map<string, Mesh> = new Map();
	private blockEdges: Map<string, LineSegments> = new Map();
	private playerMesh!: Mesh;
	private playerEdges!: LineSegments;
	private enemyMeshes: Mesh[] = [];
	private enemyEdges: LineSegments[] = [];
	private arenaWalls!: Group;
	private gridFloor!: Group;
	private slideBlockMesh: Mesh | null = null;
	private slideBlockEdge: LineSegments | null = null;

	init() {
		gameState.loadPersistence();
		this.blockGroup = new Group();
		this.world.scene.add(this.blockGroup);
		this.arenaWalls = new Group();
		this.world.scene.add(this.arenaWalls);
		this.gridFloor = new Group();
		this.world.scene.add(this.gridFloor);
		this.createArena();
		this.createPlayer();
		this.setupCamera();
	}

	private setupCamera() {
		const cam = this.world.camera;
		cam.position.set(0, 8, 5);
		cam.lookAt(0, 0, 0);
	}

	private getScheme() { return COLOR_SCHEMES[gameState.colorScheme] || COLOR_SCHEMES.cyan; }

	private createArena() {
		// Clear old
		while (this.arenaWalls.children.length) this.arenaWalls.remove(this.arenaWalls.children[0]);
		while (this.gridFloor.children.length) this.gridFloor.remove(this.gridFloor.children[0]);
		const scheme = this.getScheme();
		const pc = new Color(scheme.primary);
		// Floor grid lines
		const halfW = (COLS * CELL_SIZE) / 2;
		const halfH = (ROWS * CELL_SIZE) / 2;
		const lineMat = new LineBasicMaterial({ color: pc, transparent: true, opacity: 0.15 });
		for (let c = 0; c <= COLS; c++) {
			const x = -halfW + c * CELL_SIZE;
			const geo = new BoxGeometry(0.01, 0.01, ROWS * CELL_SIZE);
			const line = new Mesh(geo, new MeshStandardMaterial({ color: pc, emissive: pc, emissiveIntensity: 0.3, transparent: true, opacity: 0.2 }));
			line.position.set(x, 0.01, 0);
			this.gridFloor.add(line);
		}
		for (let r = 0; r <= ROWS; r++) {
			const z = -halfH + r * CELL_SIZE;
			const geo = new BoxGeometry(COLS * CELL_SIZE, 0.01, 0.01);
			const line = new Mesh(geo, new MeshStandardMaterial({ color: pc, emissive: pc, emissiveIntensity: 0.3, transparent: true, opacity: 0.2 }));
			line.position.set(0, 0.01, z);
			this.gridFloor.add(line);
		}
		// Arena border walls
		const wallMat = new MeshStandardMaterial({ color: pc, emissive: pc, emissiveIntensity: 0.5, transparent: true, opacity: 0.6 });
		const wallH = 0.6;
		const wallT = 0.08;
		// Top
		const topWall = new Mesh(new BoxGeometry(COLS * CELL_SIZE + wallT * 2, wallH, wallT), wallMat);
		topWall.position.set(0, wallH / 2, -halfH - wallT / 2);
		this.arenaWalls.add(topWall);
		// Bottom
		const botWall = new Mesh(new BoxGeometry(COLS * CELL_SIZE + wallT * 2, wallH, wallT), wallMat.clone());
		botWall.position.set(0, wallH / 2, halfH + wallT / 2);
		this.arenaWalls.add(botWall);
		// Left
		const leftWall = new Mesh(new BoxGeometry(wallT, wallH, ROWS * CELL_SIZE), wallMat.clone());
		leftWall.position.set(-halfW - wallT / 2, wallH / 2, 0);
		this.arenaWalls.add(leftWall);
		// Right
		const rightWall = new Mesh(new BoxGeometry(wallT, wallH, ROWS * CELL_SIZE), wallMat.clone());
		rightWall.position.set(halfW + wallT / 2, wallH / 2, 0);
		this.arenaWalls.add(rightWall);
	}

	private createPlayer() {
		const scheme = this.getScheme();
		const pc = new Color(scheme.primary);
		const geo = new IcosahedronGeometry(CELL_SIZE * 0.3, 1);
		const mat = new MeshStandardMaterial({ color: pc, emissive: pc, emissiveIntensity: 0.8, transparent: true, opacity: 0.9 });
		this.playerMesh = new Mesh(geo, mat);
		this.playerMesh.position.set(0, 0.4, 0);
		this.world.scene.add(this.playerMesh);
		const edgeGeo = new EdgesGeometry(geo);
		this.playerEdges = new LineSegments(edgeGeo, new LineBasicMaterial({ color: 0xffffff }));
		this.playerMesh.add(this.playerEdges);
		this.playerMesh.visible = false;
	}

	rebuildVisuals() {
		this.createArena();
		const scheme = this.getScheme();
		const pc = new Color(scheme.primary);
		(this.playerMesh.material as MeshStandardMaterial).color.set(pc);
		(this.playerMesh.material as MeshStandardMaterial).emissive.set(pc);
		this.rebuildAllBlocks();
		this.rebuildEnemyMeshes();
	}

	private key(r: number, c: number) { return `${r},${c}`; }

	private createBlockMesh(r: number, c: number, type: CellType): Mesh {
		const scheme = this.getScheme();
		const size = CELL_SIZE * 0.85;
		let geo: BoxGeometry | OctahedronGeometry;
		let color: Color;
		let emissiveI: number;
		if (type === CellType.DIAMOND) {
			geo = new OctahedronGeometry(size * 0.45);
			color = new Color(scheme.diamond);
			emissiveI = 1.0;
		} else {
			geo = new BoxGeometry(size, size * 0.8, size);
			color = new Color(scheme.accent);
			emissiveI = 0.4;
		}
		const mat = new MeshStandardMaterial({ color, emissive: color.clone(), emissiveIntensity: emissiveI, transparent: true, opacity: 0.85 });
		const mesh = new Mesh(geo, mat);
		const [x, y, z] = gameState.gridToWorld(c, r);
		mesh.position.set(x, y, z);
		this.blockGroup.add(mesh);
		const edgeGeo = new EdgesGeometry(geo);
		const edges = new LineSegments(edgeGeo, new LineBasicMaterial({ color: type === CellType.DIAMOND ? 0xffffff : new Color(scheme.primary) }));
		mesh.add(edges);
		this.blockMeshes.set(this.key(r, c), mesh);
		this.blockEdges.set(this.key(r, c), edges);
		return mesh;
	}

	private removeBlockMesh(r: number, c: number) {
		const k = this.key(r, c);
		const mesh = this.blockMeshes.get(k);
		if (mesh) { this.blockGroup.remove(mesh); this.blockMeshes.delete(k); this.blockEdges.delete(k); }
	}

	rebuildAllBlocks() {
		for (const [, mesh] of this.blockMeshes) this.blockGroup.remove(mesh);
		this.blockMeshes.clear();
		this.blockEdges.clear();
		for (let r = 0; r < ROWS; r++)
			for (let c = 0; c < COLS; c++)
				if (gameState.grid[r] && gameState.grid[r][c] !== CellType.EMPTY)
					this.createBlockMesh(r, c, gameState.grid[r][c]);
	}

	private rebuildEnemyMeshes() {
		for (const m of this.enemyMeshes) this.world.scene.remove(m);
		this.enemyMeshes = [];
		this.enemyEdges = [];
		const scheme = this.getScheme();
		const ec = new Color(scheme.enemy);
		for (const enemy of gameState.enemies) {
			const geo = new SphereGeometry(CELL_SIZE * 0.3, 8, 6);
			const mat = new MeshStandardMaterial({ color: ec, emissive: ec, emissiveIntensity: 0.8, transparent: true, opacity: 0.9 });
			const mesh = new Mesh(geo, mat);
			const [x, y, z] = gameState.gridToWorld(enemy.col, enemy.row);
			mesh.position.set(x, y, z);
			mesh.visible = enemy.state !== EnemyState.DYING;
			this.world.scene.add(mesh);
			const edgeGeo = new EdgesGeometry(geo);
			const edges = new LineSegments(edgeGeo, new LineBasicMaterial({ color: 0xffffff }));
			mesh.add(edges);
			this.enemyMeshes.push(mesh);
			this.enemyEdges.push(edges);
		}
	}

	onStartGame() {
		this.rebuildAllBlocks();
		this.rebuildEnemyMeshes();
		this.playerMesh.visible = true;
		const [px, py, pz] = gameState.gridToWorld(gameState.playerCol, gameState.playerRow);
		this.playerMesh.position.set(px, py, pz);
		if (this.slideBlockMesh) { this.blockGroup.remove(this.slideBlockMesh); this.slideBlockMesh = null; this.slideBlockEdge = null; }
	}

	onEndGame() {
		this.playerMesh.visible = false;
	}

	onNextWave() {
		gameState.wave++;
		gameState.careerWaves++;
		gameState.noDeathThisWave = true;
		gameState.waveElapsed = 0;
		gameState.initGrid();
		gameState.playerMoving = false;
		gameState.blockSliding = false;
		this.rebuildAllBlocks();
		this.rebuildEnemyMeshes();
		const [px, py, pz] = gameState.gridToWorld(gameState.playerCol, gameState.playerRow);
		this.playerMesh.position.set(px, py, pz);
		if (this.slideBlockMesh) { this.blockGroup.remove(this.slideBlockMesh); this.slideBlockMesh = null; this.slideBlockEdge = null; }
		if (gameState.wave >= 5) gameState.tryAchievement('wave_5');
		if (gameState.wave >= 10) gameState.tryAchievement('wave_10');
	}

	tryMove(dir: Direction) {
		if (gameState.phase !== GamePhase.PLAYING || gameState.playerMoving || gameState.blockSliding) return;
		gameState.playerDir = dir;
		const dr = dir === Direction.UP ? -1 : dir === Direction.DOWN ? 1 : 0;
		const dc = dir === Direction.LEFT ? -1 : dir === Direction.RIGHT ? 1 : 0;
		const nr = gameState.playerRow + dr;
		const nc = gameState.playerCol + dc;
		// Check wall push (stun)
		if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) {
			this.wallStun(dir);
			return;
		}
		// Check if target has a block
		if (gameState.grid[nr][nc] !== CellType.EMPTY) {
			this.pushBlock(nr, nc, dir);
			return;
		}
		// Check if enemy is there
		const enemyAtTarget = gameState.enemies.find(e => e.row === nr && e.col === nc && e.state !== EnemyState.DYING && !e.moving);
		if (enemyAtTarget) return; // Can't walk into enemy
		// Move player
		gameState.playerFromRow = gameState.playerRow;
		gameState.playerFromCol = gameState.playerCol;
		gameState.playerRow = nr;
		gameState.playerCol = nc;
		gameState.playerMoving = true;
		gameState.playerMoveProgress = 0;
	}

	private wallStun(dir: Direction) {
		let stunned = 0;
		for (const enemy of gameState.enemies) {
			if (enemy.state === EnemyState.DYING) continue;
			let near = false;
			if (dir === Direction.UP && enemy.row <= 1) near = true;
			if (dir === Direction.DOWN && enemy.row >= ROWS - 2) near = true;
			if (dir === Direction.LEFT && enemy.col <= 1) near = true;
			if (dir === Direction.RIGHT && enemy.col >= COLS - 2) near = true;
			if (near && enemy.state === EnemyState.ACTIVE) {
				enemy.state = EnemyState.STUNNED;
				enemy.stunTimer = 3;
				stunned++;
				gameState.totalStuns++;
			}
		}
		if (stunned > 0) {
			gameState.tryAchievement('wall_stun');
			if (gameState.totalStuns >= 10) gameState.tryAchievement('stun_10');
			gameState.score += stunned * 30;
		}
	}

	private pushBlock(br: number, bc: number, dir: Direction) {
		const dr = dir === Direction.UP ? -1 : dir === Direction.DOWN ? 1 : 0;
		const dc = dir === Direction.LEFT ? -1 : dir === Direction.RIGHT ? 1 : 0;
		// Find where block slides to
		let tr = br + dr, tc = bc + dc;
		// Check if block can move at all
		if (tr < 0 || tr >= ROWS || tc < 0 || tc >= COLS || gameState.grid[tr][tc] !== CellType.EMPTY) {
			// Block can't move - break it (if ice, not diamond)
			if (gameState.grid[br][bc] === CellType.ICE) {
				gameState.grid[br][bc] = CellType.EMPTY;
				this.removeBlockMesh(br, bc);
				gameState.pushCount++;
				if (gameState.mode === GameMode.CHALLENGE) gameState.challengeMoves--;
			}
			return;
		}
		// Block slides
		while (tr >= 0 && tr < ROWS && tc >= 0 && tc < COLS && gameState.grid[tr][tc] === CellType.EMPTY) {
			tr += dr; tc += dc;
		}
		tr -= dr; tc -= dc; // Back to last valid
		const cellType = gameState.grid[br][bc];
		gameState.grid[br][bc] = CellType.EMPTY;
		this.removeBlockMesh(br, bc);
		// Start slide animation
		gameState.blockSliding = true;
		gameState.slideCol = bc; gameState.slideRow = br;
		gameState.slideTargetCol = tc; gameState.slideTargetRow = tr;
		gameState.slideDir = dir;
		gameState.slideProgress = 0;
		gameState.slideCellType = cellType;
		gameState.crushedThisPush = [];
		gameState.pushCount++;
		if (gameState.mode === GameMode.CHALLENGE) gameState.challengeMoves--;
		// Create sliding block mesh
		const scheme = this.getScheme();
		const size = CELL_SIZE * 0.85;
		let geo: BoxGeometry | OctahedronGeometry;
		let color: Color;
		if (cellType === CellType.DIAMOND) {
			geo = new OctahedronGeometry(size * 0.45);
			color = new Color(scheme.diamond);
		} else {
			geo = new BoxGeometry(size, size * 0.8, size);
			color = new Color(scheme.accent);
		}
		const mat = new MeshStandardMaterial({ color, emissive: color.clone(), emissiveIntensity: cellType === CellType.DIAMOND ? 1.0 : 0.4, transparent: true, opacity: 0.85 });
		this.slideBlockMesh = new Mesh(geo, mat);
		const [sx, sy, sz] = gameState.gridToWorld(bc, br);
		this.slideBlockMesh.position.set(sx, sy, sz);
		const edgeGeo = new EdgesGeometry(geo);
		this.slideBlockEdge = new LineSegments(edgeGeo, new LineBasicMaterial({ color: cellType === CellType.DIAMOND ? 0xffffff : new Color(scheme.primary) }));
		this.slideBlockMesh.add(this.slideBlockEdge);
		this.blockGroup.add(this.slideBlockMesh);
		if (gameState.pushCount >= 100) gameState.tryAchievement('pushes_100');
		if (gameState.pushCount >= 500) gameState.tryAchievement('pushes_500');
	}

	private checkDiamondAlignment() {
		// Check rows
		for (let r = 0; r < ROWS; r++) {
			let count = 0;
			for (let c = 0; c < COLS; c++) {
				if (gameState.grid[r][c] === CellType.DIAMOND) { count++; if (count >= 3) return true; }
				else count = 0;
			}
		}
		// Check columns
		for (let c = 0; c < COLS; c++) {
			let count = 0;
			for (let r = 0; r < ROWS; r++) {
				if (gameState.grid[r][c] === CellType.DIAMOND) { count++; if (count >= 3) return true; }
				else count = 0;
			}
		}
		return false;
	}

	private respawnPlayer() {
		gameState.lives--;
		gameState.noDeathThisWave = false;
		if (gameState.lives <= 0) {
			if (gameState.mode === GameMode.CHALLENGE && gameState.wave > 1) gameState.tryAchievement('challenge_win');
			gameState.endGame();
			this.onEndGame();
			return;
		}
		// Find empty cell near bottom
		gameState.playerRow = ROWS - 1;
		gameState.playerCol = Math.floor(COLS / 2);
		// Find nearest empty
		for (let dc = 0; dc < COLS; dc++) {
			for (const sign of [0, 1, -1]) {
				const c = gameState.playerCol + dc * (sign || 1);
				if (c >= 0 && c < COLS && gameState.grid[gameState.playerRow][c] === CellType.EMPTY) {
					gameState.playerCol = c;
					gameState.playerMoving = false;
					const [px, py, pz] = gameState.gridToWorld(gameState.playerCol, gameState.playerRow);
					this.playerMesh.position.set(px, py, pz);
					return;
				}
			}
		}
	}

	update(delta: number) {
		if (gameState.phase !== GamePhase.PLAYING) return;
		const gs = gameState;
		gs.waveElapsed += delta;
		// Speed mode timer
		if (gs.mode === 'speed') {
			gs.speedTimer -= delta;
			if (gs.speedTimer <= 0) { gs.endGame(); this.onEndGame(); return; }
		}
		// Challenge mode moves check
		if (gs.mode === 'challenge' && gs.challengeMoves <= 0) {
			const activeEnemies = gs.enemies.filter(e => e.state !== EnemyState.DYING);
			if (activeEnemies.length > 0) { gs.endGame(); this.onEndGame(); return; }
		}
		// Combo decay
		if (gs.comboTimer > 0) { gs.comboTimer -= delta; if (gs.comboTimer <= 0) gs.combo = 0; }
		// Achievement timer
		if (gs.achievementTimer > 0) { gs.achievementTimer -= delta; if (gs.achievementTimer <= 0) gs.pendingAchievement = null; }
		// Player movement animation
		if (gs.playerMoving) {
			gs.playerMoveProgress += delta * PLAYER_MOVE_SPEED;
			if (gs.playerMoveProgress >= 1) {
				gs.playerMoveProgress = 1;
				gs.playerMoving = false;
			}
			const [fx, fy, fz] = gs.gridToWorld(gs.playerFromCol, gs.playerFromRow);
			const [tx, , tz] = gs.gridToWorld(gs.playerCol, gs.playerRow);
			const t = gs.playerMoveProgress;
			this.playerMesh.position.set(fx + (tx - fx) * t, fy, fz + (tz - fz) * t);
		}
		// Block sliding animation
		if (gs.blockSliding && this.slideBlockMesh) {
			gs.slideProgress += delta * BLOCK_SLIDE_SPEED;
			const [sx, sy, sz] = gs.gridToWorld(gs.slideCol, gs.slideRow);
			const [tx, , tz] = gs.gridToWorld(gs.slideTargetCol, gs.slideTargetRow);
			const totalDist = Math.sqrt((tx - sx) ** 2 + (tz - sz) ** 2);
			const t = Math.min(gs.slideProgress / (totalDist / CELL_SIZE), 1);
			const cx = sx + (tx - sx) * t;
			const cz = sz + (tz - sz) * t;
			this.slideBlockMesh.position.set(cx, sy, cz);
			// Check enemies in path
			const currentCol = Math.round((cx / CELL_SIZE) + (COLS - 1) / 2);
			const currentRow = Math.round((cz / CELL_SIZE) + (ROWS - 1) / 2);
			for (let i = 0; i < gs.enemies.length; i++) {
				const e = gs.enemies[i];
				if (e.state === EnemyState.DYING) continue;
				if (!gs.crushedThisPush.includes(i) && e.row === currentRow && e.col === currentCol) {
					e.state = EnemyState.DYING;
					gs.crushedThisPush.push(i);
					gs.totalCrushes++;
					gs.combo++;
					gs.comboTimer = 3;
					const pts = 100 * gs.combo;
					gs.score += pts;
					if (this.enemyMeshes[i]) this.enemyMeshes[i].visible = false;
				}
			}
			if (t >= 1) {
				// Block arrived
				gs.grid[gs.slideTargetRow][gs.slideTargetCol] = gs.slideCellType;
				this.createBlockMesh(gs.slideTargetRow, gs.slideTargetCol, gs.slideCellType);
				this.blockGroup.remove(this.slideBlockMesh);
				this.slideBlockMesh = null;
				this.slideBlockEdge = null;
				gs.blockSliding = false;
				// Check crush achievements
				const crushed = gs.crushedThisPush.length;
				if (crushed > 0) gs.tryAchievement('first_crush');
				if (crushed >= 2) gs.tryAchievement('combo_2');
				if (crushed >= 3) gs.tryAchievement('combo_3');
				if (gs.totalCrushes >= 10) gs.tryAchievement('crush_10');
				if (gs.totalCrushes >= 50) gs.tryAchievement('crush_50');
				if (gs.totalCrushes >= 100) gs.tryAchievement('crush_100');
				// Check diamond alignment
				if (this.checkDiamondAlignment()) {
					gs.score += 1000;
					gs.totalDiamondAligns++;
					gs.tryAchievement('diamond_align');
					if (gs.totalDiamondAligns >= 5) gs.tryAchievement('diamond_5');
				}
				// Score achievements
				if (gs.score >= 1000) gs.tryAchievement('score_1k');
				if (gs.score >= 5000) gs.tryAchievement('score_5k');
				if (gs.score >= 10000) gs.tryAchievement('score_10k');
				if (gs.score >= 25000) gs.tryAchievement('score_25k');
				// Remove dead enemies
				this.cleanupDeadEnemies();
			}
		}
		// Enemy updates
		this.updateEnemies(delta);
		// Check wave clear
		const activeEnemies = gs.enemies.filter(e => e.state !== EnemyState.DYING);
		if (activeEnemies.length === 0 && !gs.blockSliding) {
			if (gs.wave === 1) gs.tryAchievement('wave_clear');
			if (gs.noDeathThisWave) gs.tryAchievement('no_death_wave');
			if (gs.waveElapsed < 15) gs.tryAchievement('speed_clear');
			gs.score += 200 * gs.wave;
			this.onNextWave();
		}
		// Player rotation
		const angles = [Math.PI, 0, Math.PI / 2, -Math.PI / 2];
		this.playerMesh.rotation.y += (angles[gs.playerDir] - this.playerMesh.rotation.y) * 0.2;
		// Player bob
		this.playerMesh.position.y = 0.4 + Math.sin(Date.now() * 0.003) * 0.03;
	}

	private updateEnemies(delta: number) {
		const gs = gameState;
		for (let i = 0; i < gs.enemies.length; i++) {
			const e = gs.enemies[i];
			if (e.state === EnemyState.DYING) continue;
			// Hatching
			if (e.state === EnemyState.HATCHING) {
				e.hatchTimer -= delta;
				if (e.hatchTimer <= 0) e.state = EnemyState.ACTIVE;
				if (this.enemyMeshes[i]) {
					const scale = Math.max(0.3, 1 - e.hatchTimer);
					this.enemyMeshes[i].scale.setScalar(scale);
				}
				continue;
			}
			// Stunned
			if (e.state === EnemyState.STUNNED) {
				e.stunTimer -= delta;
				if (e.stunTimer <= 0) e.state = EnemyState.ACTIVE;
				if (this.enemyMeshes[i]) {
					this.enemyMeshes[i].position.y = 0.4 + Math.sin(Date.now() * 0.02) * 0.05;
					const mat = this.enemyMeshes[i].material as MeshStandardMaterial;
					mat.opacity = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
				}
				continue;
			}
			// Active movement
			if (e.moving) {
				e.moveProgress += delta * ENEMY_MOVE_SPEED;
				if (e.moveProgress >= 1) {
					e.moveProgress = 1;
					e.moving = false;
					e.fromRow = e.row;
					e.fromCol = e.col;
				}
				if (this.enemyMeshes[i]) {
					const [fx, fy, fz] = gs.gridToWorld(e.fromCol, e.fromRow);
					const [tx, , tz] = gs.gridToWorld(e.col, e.row);
					const t = e.moveProgress;
					this.enemyMeshes[i].position.set(fx + (tx - fx) * t, fy, fz + (tz - fz) * t);
				}
			} else {
				e.moveTimer -= delta;
				if (e.moveTimer <= 0) {
					e.moveTimer = gs.getEnemySpeed();
					this.moveEnemy(i);
				}
			}
			// Check collision with player
			if (!gs.playerMoving && e.row === gs.playerRow && e.col === gs.playerCol) {
				this.respawnPlayer();
				return;
			}
			// Interpolated collision
			if (this.enemyMeshes[i] && this.playerMesh.visible) {
				const dist = this.enemyMeshes[i].position.distanceTo(this.playerMesh.position);
				if (dist < CELL_SIZE * 0.4) {
					this.respawnPlayer();
					return;
				}
			}
		}
	}

	private moveEnemy(idx: number) {
		const e = gameState.enemies[idx];
		const gs = gameState;
		// Simple chase AI: 70% move toward player, 30% random
		const dirs: Direction[] = [];
		const dr = gs.playerRow - e.row;
		const dc = gs.playerCol - e.col;
		if (Math.random() < 0.7) {
			// Prioritize direction toward player
			if (Math.abs(dr) > Math.abs(dc)) {
				dirs.push(dr < 0 ? Direction.UP : Direction.DOWN);
				dirs.push(dc < 0 ? Direction.LEFT : Direction.RIGHT);
			} else {
				dirs.push(dc < 0 ? Direction.LEFT : Direction.RIGHT);
				dirs.push(dr < 0 ? Direction.UP : Direction.DOWN);
			}
			dirs.push(Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT);
		} else {
			dirs.push(Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT);
			// Shuffle
			for (let i = dirs.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[dirs[i], dirs[j]] = [dirs[j], dirs[i]];
			}
		}
		for (const d of dirs) {
			const mdr = d === Direction.UP ? -1 : d === Direction.DOWN ? 1 : 0;
			const mdc = d === Direction.LEFT ? -1 : d === Direction.RIGHT ? 1 : 0;
			const nr = e.row + mdr, nc = e.col + mdc;
			if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
			if (gs.grid[nr][nc] !== CellType.EMPTY) continue;
			// Don't move into another enemy
			const otherEnemy = gs.enemies.find((oe, oi) => oi !== idx && oe.row === nr && oe.col === nc && oe.state !== EnemyState.DYING);
			if (otherEnemy) continue;
			e.fromRow = e.row; e.fromCol = e.col;
			e.row = nr; e.col = nc;
			e.moveDir = d;
			e.moving = true;
			e.moveProgress = 0;
			break;
		}
	}

	private cleanupDeadEnemies() {
		const gs = gameState;
		const alive: EnemyData[] = [];
		const aliveMeshes: Mesh[] = [];
		const aliveEdges: LineSegments[] = [];
		for (let i = 0; i < gs.enemies.length; i++) {
			if (gs.enemies[i].state !== EnemyState.DYING) {
				alive.push(gs.enemies[i]);
				aliveMeshes.push(this.enemyMeshes[i]);
				aliveEdges.push(this.enemyEdges[i]);
			} else {
				if (this.enemyMeshes[i]) this.world.scene.remove(this.enemyMeshes[i]);
			}
		}
		gs.enemies = alive;
		this.enemyMeshes = aliveMeshes;
		this.enemyEdges = aliveEdges;
	}
}
