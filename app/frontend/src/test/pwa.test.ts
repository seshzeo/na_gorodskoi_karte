import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const publicDirectory = resolve(process.cwd(), "public");
const manifestPath = resolve(publicDirectory, "manifest.webmanifest");

describe("PWA assets", () => {
  it("defines the installable app at the root deployment path", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    expect(manifest).toMatchObject({
      name: "НА городской карте",
      short_name: "На карте",
      description: "Городская карта событий и интересных мест",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: "#f7f9fc",
      background_color: "#f7f9fc",
    });
    expect(manifest.icons).toHaveLength(2);
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual([
      "192x192",
      "512x512",
    ]);

    for (const icon of manifest.icons as Array<{ src: string; sizes: string }>) {
      const iconPath = resolve(publicDirectory, icon.src.slice(1));
      const png = readFileSync(iconPath);
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
      const expectedSize = Number(icon.sizes.split("x")[0]);
      expect(png.readUInt32BE(16)).toBe(expectedSize);
      expect(png.readUInt32BE(20)).toBe(expectedSize);
    }
  });
});
