import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  openSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { ensure } from "../../common/core.js";

export interface InstagramConnection {
  accountId: string;
  username: string;
  accountType: string;
  accessToken: string;
  expiresAt: string | null;
  obtainedAt: string;
  permissions: string[];
}
export interface VaultState {
  connection: InstagramConnection | null;
  disconnected: boolean;
}
/** Single-user encrypted local credential store; never part of the editorial aggregate or Prisma JSON. */
export class InstagramVault {
  readonly directory: string;
  constructor(
    directory = ".local/instagram",
    private suppliedKey?: Buffer,
  ) {
    this.directory = resolve(directory);
  }
  initialize(): void {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    if (process.platform === "win32" && !this.suppliedKey) {
      const owner = execFileSync("whoami.exe", [], {
        encoding: "utf8",
        windowsHide: true,
      }).trim();
      execFileSync(
        "icacls.exe",
        [this.directory, "/inheritance:r", "/grant:r", `${owner}:(OI)(CI)F`],
        { stdio: "ignore", windowsHide: true },
      );
    }
    if (
      !this.suppliedKey &&
      !process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY &&
      !existsSync(join(this.directory, "vault.key"))
    )
      writeFileSync(join(this.directory, "vault.key"), randomBytes(32), {
        mode: 0o600,
        flag: "wx",
      });
  }
  private key(): Buffer {
    const key =
      this.suppliedKey ??
      (process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY
        ? Buffer.from(process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY, "base64")
        : readFileSync(join(this.directory, "vault.key")));
    ensure(
      key.length === 32,
      "Instagram vault key must contain exactly 32 bytes",
    );
    return key;
  }
  read(): VaultState | undefined {
    const path = join(this.directory, "connection.enc");
    if (!existsSync(path)) return undefined;
    try {
      const bytes = readFileSync(path),
        decipher = createDecipheriv(
          "aes-256-gcm",
          this.key(),
          bytes.subarray(0, 12),
        );
      decipher.setAuthTag(bytes.subarray(12, 28));
      return JSON.parse(
        Buffer.concat([
          decipher.update(bytes.subarray(28)),
          decipher.final(),
        ]).toString("utf8"),
      ) as VaultState;
    } catch {
      throw new Error(
        "Instagram credential vault cannot be decrypted; restore its key or reconnect explicitly",
      );
    }
  }
  write(state: VaultState): void {
    this.initialize();
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(state), "utf8"),
      cipher.final(),
    ]);
    const path = join(this.directory, "connection.enc"),
      temp = path + ".tmp";
    const fd = openSync(temp, "w", 0o600);
    try {
      writeFileSync(fd, Buffer.concat([iv, cipher.getAuthTag(), encrypted]));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temp, path);
  }
  connection(
    env: NodeJS.ProcessEnv = process.env,
  ): InstagramConnection | undefined {
    const stored = this.read();
    if (stored)
      return stored.disconnected ? undefined : (stored.connection ?? undefined);
    if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_USER_ID) return undefined;
    return {
      accountId: env.INSTAGRAM_USER_ID,
      username: "",
      accountType: "",
      accessToken: env.INSTAGRAM_ACCESS_TOKEN,
      expiresAt: env.INSTAGRAM_TOKEN_EXPIRES_AT || null,
      obtainedAt: "",
      permissions: [],
    };
  }
}
