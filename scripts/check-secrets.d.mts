export declare const SECRET_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }>;
export declare function isForbiddenEnvFile(path: string): boolean;
export declare function findSecrets(content: string): string[];
