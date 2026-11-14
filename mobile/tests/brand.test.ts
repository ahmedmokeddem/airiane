import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = JSON.parse(
  readFileSync(new URL("../app.json", import.meta.url), "utf8"),
).expo;
test("AIriane changes visible native identity while retaining technical package and deep links", () => {
  assert.equal(app.name, "AIriane");
  assert.equal(app.android.package, "dev.re.patient");
  assert.equal(app.ios.bundleIdentifier, "dev.re.patient");
  assert.equal(app.scheme, "re-patient");
  assert.equal(
    app.android.adaptiveIcon.foregroundImage,
    "./assets/brand/adaptive-foreground.png",
  );
  assert.ok(
    app.plugins.some(
      (p: unknown) =>
        Array.isArray(p) &&
        p[0] === "expo-splash-screen" &&
        p[1].image === "./assets/brand/launcher.png" &&
        p[1].backgroundColor === "#081018",
    ),
  );
});
test("native exports have real PNG dimensions and original logo sources remain distinct", () => {
  for (const [file, w, h] of [
    ["launcher.png", 1024, 1024],
    ["adaptive-foreground.png", 1024, 1024],
    ["airiane-wordmark.png", 920, 240],
  ] as const) {
    const png = readFileSync(
      new URL("../assets/brand/" + file, import.meta.url),
    );
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), w);
    assert.equal(png.readUInt32BE(20), h);
  }
  const symbol = readFileSync(
    new URL("../../assets/brand/logo/airiane-symbol.svg", import.meta.url),
    "utf8",
  );
  const wordmark = readFileSync(
    new URL("../../assets/brand/logo/airiane-wordmark.svg", import.meta.url),
    "utf8",
  );
  assert.ok(!symbol.includes("<text"));
  assert.ok(
    wordmark.includes('font-family="Inter, Avenir Next, Arial, sans-serif"'),
  );
});
