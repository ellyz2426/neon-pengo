import { createSystem, World, Mesh, SphereGeometry, MeshStandardMaterial, Color, Group } from '@iwsdk/core';
import { gameState } from './game-system';
import { GamePhase, COLOR_SCHEMES } from './game-state';

interface Particle { mesh: Mesh; vx: number; vy: number; vz: number; life: number; maxLife: number; }

export class EffectsSystem extends createSystem({}) {
	private particles: Particle[] = [];
	private group!: Group;
	private ambientOrbs: Mesh[] = [];

	init() {
		this.group = new Group();
		this.world.scene.add(this.group);
		this.createAmbientOrbs();
	}

	private createAmbientOrbs() {
		const scheme = COLOR_SCHEMES[gameState.colorScheme] || COLOR_SCHEMES.cyan;
		const pc = new Color(scheme.primary);
		for (let i = 0; i < 20; i++) {
			const geo = new SphereGeometry(0.03 + Math.random() * 0.03);
			const mat = new MeshStandardMaterial({ color: pc, emissive: pc, emissiveIntensity: 1.5, transparent: true, opacity: 0.4 });
			const orb = new Mesh(geo, mat);
			orb.position.set((Math.random() - 0.5) * 12, 1 + Math.random() * 4, (Math.random() - 0.5) * 10);
			orb.userData.baseY = orb.position.y;
			orb.userData.phase = Math.random() * Math.PI * 2;
			orb.userData.speed = 0.3 + Math.random() * 0.5;
			this.world.scene.add(orb);
			this.ambientOrbs.push(orb);
		}
	}

	burst(x: number, y: number, z: number, color: string, count: number = 8) {
		const c = new Color(color);
		for (let i = 0; i < count; i++) {
			const geo = new SphereGeometry(0.03);
			const mat = new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2, transparent: true, opacity: 1 });
			const mesh = new Mesh(geo, mat);
			mesh.position.set(x, y, z);
			this.group.add(mesh);
			this.particles.push({
				mesh, life: 0.6 + Math.random() * 0.4, maxLife: 1,
				vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 3,
			});
		}
	}

	update(delta: number) {
		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];
			p.life -= delta;
			if (p.life <= 0) { this.group.remove(p.mesh); this.particles.splice(i, 1); continue; }
			p.vy -= 5 * delta;
			p.mesh.position.x += p.vx * delta;
			p.mesh.position.y += p.vy * delta;
			p.mesh.position.z += p.vz * delta;
			(p.mesh.material as MeshStandardMaterial).opacity = p.life / p.maxLife;
		}
		for (const orb of this.ambientOrbs) {
			orb.position.y = orb.userData.baseY + Math.sin(Date.now() * 0.001 * orb.userData.speed + orb.userData.phase) * 0.3;
		}
	}
}
