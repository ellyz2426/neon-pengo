import { World, PanelUI, ScreenSpace } from '@iwsdk/core';
import { GameSystem } from './game-system';
import { InputSystem } from './input-system';
import { UISystem } from './ui-system';
import { AudioSystem } from './audio-system';
import { EffectsSystem } from './effects-system';
import { EnvironmentSystem } from './environment-system';

const container = document.getElementById('scene-container') as HTMLDivElement;

async function main() {
	const world = await World.create(container, {
		xr: { offer: 'once' },
		features: { locomotion: { browserControls: true } },
	} as any);

	world.registerSystem(GameSystem);
	world.registerSystem(InputSystem);
	world.registerSystem(AudioSystem);
	world.registerSystem(EffectsSystem);
	world.registerSystem(EnvironmentSystem);
	world.registerSystem(UISystem);

	const panelConfigs = [
		'./ui/menu.json', './ui/hud.json', './ui/pause.json', './ui/results.json',
		'./ui/settings.json', './ui/achievements.json', './ui/stats.json', './ui/tutorial.json',
	];
	for (const config of panelConfigs) {
		const entity = (world as any).ecs.createEntity();
		entity.addComponent(PanelUI, { config });
		entity.addComponent(ScreenSpace, {});
	}
}

main().catch(console.error);
