import { GameState } from '../store/gameStore';

export const saveGame = async (state: GameState) => {
  console.log('--- MOCK API: Saving Game ---');
  console.log('Player:', state.player.name);
  console.log('Race:', state.player.race);
  console.log('Resources:', JSON.stringify(state.resources));
  console.log('Workers:', JSON.stringify(state.workers));
  
  // Simulate network delay
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('--- MOCK API: Save Successful ---');
      resolve({ success: true });
    }, 500);
  });
};

export const loadGame = async (): Promise<Partial<GameState> | null> => {
  console.log('--- MOCK API: Loading Game ---');
  // In a real app, this would fetch from a database
  return null;
};
