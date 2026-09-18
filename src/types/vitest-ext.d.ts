import 'vitest';

declare module 'vitest' {
  interface VitestUtils {
    unsetenv(key: string): void;
    unsetAllEnvs(): void;
    setenv(key: string, value: string): void;
    setEnv(key: string, value: string): void;
  }
}
