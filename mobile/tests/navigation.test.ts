import test from "node:test";
import assert from "node:assert/strict";
import {
  destinations,
  selectedTab,
  isImmersive,
} from "../src/features/product/navigation";
test("persistent patient destinations are actual routes and Companion defaults to text", () => {
  assert.deepEqual(
    destinations.map((d) => d.path),
    ["/", "/text", "/activities", "/journey"],
  );
  assert.equal(
    destinations.find((d) => d.label === "Companion")?.path,
    "/text",
  );
  for (const d of destinations) assert.equal(selectedTab(d.path), d.key);
  assert.equal(selectedTab("/profile"), null);
});
test("call and in-call activity replace standard navigation, standalone activities retain it", () => {
  assert.equal(isImmersive("/voice", false), true);
  assert.equal(isImmersive("/breathing", true), true);
  assert.equal(isImmersive("/breathing", false), false);
  assert.equal(isImmersive("/text", false), false);
});
