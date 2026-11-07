import { expect, it } from "vitest";
import { cachePolicy } from "../shared/lib/cache";

it("exposes cache policy used by the frontend", () => {
  expect(cachePolicy.categories.staleTime).toBe(300000);
  expect(cachePolicy.categories.gcTime).toBe(1800000);
  expect(cachePolicy.points.staleTime).toBe(30000);
  expect(cachePolicy.points.gcTime).toBe(300000);
  expect(cachePolicy.staticAssets).toBe("immutable");
  expect(cachePolicy.publicApi).toBe("s-maxage=60");
});
