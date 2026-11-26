// Thin launcher for scripts/sim-chimera-balance.ts. simulate.ts imports the game's
// real engine/host/bot-AI sources unmodified, using the same extensionless,
// bundler-resolved TS imports those files already use elsewhere in the repo
// - so it's loaded through Vite's own SSR module graph (already a project
// dependency) instead of adding a TS-execution package just for this script.
import { createServer } from 'vite';

const server = await createServer({
  root: process.cwd(),
  configFile: false,
  logLevel: 'warn',
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const mod = await server.ssrLoadModule('/scripts/sim-chimera-balance.ts');
  await mod.main(process.argv.slice(2));
} finally {
  await server.close();
}
