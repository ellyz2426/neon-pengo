import { createSystem, World, Mesh, BoxGeometry, MeshStandardMaterial, Color, FogExp2, AmbientLight, PointLight, SphereGeometry } from '@iwsdk/core';
import { gameState } from './game-system';
import { COLOR_SCHEMES } from './game-state';

export class EnvironmentSystem extends createSystem({}) {
	private pillars: Mesh[] = [];
	private ceilingBeams: Mesh[] = [];
	private stars: Mesh[] = [];

	init() {
		const scheme = COLOR_SCHEMES[gameState.colorScheme] || COLOR_SCHEMES.cyan;
		const pc = new Color(scheme.primary);
		// Fog
		this.world.scene.fog = new FogExp2(0x000811, 0.04);
		// Lighting
		const ambient = new AmbientLight(0x112233, 0.3);
		this.world.scene.add(ambient);
		const pl1 = new PointLight(pc, 2, 20);
		pl1.position.set(0, 6, 0);
		this.world.scene.add(pl1);
		const pl2 = new PointLight(pc, 1, 15);
		pl2.position.set(-5, 4, -4);
		this.world.scene.add(pl2);
		const pl3 = new PointLight(pc, 1, 15);
		pl3.position.set(5, 4, 4);
		this.world.scene.add(pl3);
		// Grid floor plane
		const floorGeo = new BoxGeometry(20, 0.02, 16);
		const floorMat = new MeshStandardMaterial({ color: 0x000811, emissive: pc, emissiveIntensity: 0.02 });
		const floor = new Mesh(floorGeo, floorMat);
		floor.position.set(0, -0.01, 0);
		this.world.scene.add(floor);
		// Pillars
		const pillarMat = new MeshStandardMaterial({ color: pc, emissive: pc, emissiveIntensity: 0.3, transparent: true, opacity: 0.15, wireframe: true });
		for (let i = 0; i < 6; i++) {
			const angle = (i / 6) * Math.PI * 2;
			const geo = new BoxGeometry(0.15, 8, 0.15);
			const pillar = new Mesh(geo, pillarMat.clone());
			pillar.position.set(Math.cos(angle) * 9, 4, Math.sin(angle) * 7);
			this.world.scene.add(pillar);
			this.pillars.push(pillar);
			// Cap
			const capGeo = new SphereGeometry(0.12);
			const capMat = new MeshStandardMaterial({ color: pc, emissive: pc, emissiveIntensity: 1, transparent: true, opacity: 0.6 });
			const cap = new Mesh(capGeo, capMat);
			cap.position.set(pillar.position.x, 8, pillar.position.z);
			this.world.scene.add(cap);
		}
		// Ceiling light strips
		for (let i = 0; i < 4; i++) {
			const geo = new BoxGeometry(14, 0.02, 0.05);
			const mat = new MeshStandardMaterial({ color: pc, emissive: pc, emissiveIntensity: 0.8, transparent: true, opacity: 0.4 });
			const beam = new Mesh(geo, mat);
			beam.position.set(0, 7.5, -3 + i * 2);
			this.world.scene.add(beam);
			this.ceilingBeams.push(beam);
		}
		// Stars
		for (let i = 0; i < 50; i++) {
			const geo = new SphereGeometry(0.015 + Math.random() * 0.02);
			const mat = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2, transparent: true, opacity: 0.3 + Math.random() * 0.5 });
			const star = new Mesh(geo, mat);
			star.position.set((Math.random() - 0.5) * 20, 5 + Math.random() * 4, (Math.random() - 0.5) * 16);
			star.userData.twinklePhase = Math.random() * Math.PI * 2;
			this.world.scene.add(star);
			this.stars.push(star);
		}
	}

	update(delta: number) {
		const t = Date.now() * 0.001;
		for (const star of this.stars) {
			(star.material as MeshStandardMaterial).opacity = 0.3 + Math.sin(t * 2 + star.userData.twinklePhase) * 0.3;
		}
	}
}
