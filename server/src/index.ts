import { createApp } from './app.ts';
import { ConfigError, loadConfig } from './config.ts';
import { createRepository } from './repositories/create-repository.ts';

/**
 * Process entry point.
 *
 * Fails fast on bad configuration and shuts down gracefully so the JSON write
 * queue is flushed and the SQLite write-ahead log is checkpointed.
 */
async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`Cấu hình không hợp lệ: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const repository = createRepository(config);
  const app = createApp(config, repository);

  await new Promise<void>((resolve) => {
    app.server.listen(config.port, config.host, resolve);
  });

  console.warn(
    `math-runner server listening on http://${config.host}:${String(config.port)} ` +
      `(storage: ${config.storageDriver}, env: ${config.nodeEnv})`,
  );

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.warn(`Received ${signal}, shutting down...`);
    void app
      .close()
      .then(() => {
        process.exit(0);
      })
      .catch((error: unknown) => {
        console.error('Shutdown failed:', error);
        process.exit(1);
      });
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}

void main();
