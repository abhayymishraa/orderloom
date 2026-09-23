// bun test src/utils/cors.test.ts
import { expect, test } from "bun:test";
import { matchOrigin } from "./cors";

const allowed = [
  "http://localhost:3000",
  "https://orderloom.abhayymishraa.com",
  "https://*.vercel.app",
];

test("exact origins match", () => {
  expect(matchOrigin(allowed, "https://orderloom.abhayymishraa.com")).toBe(true);
  expect(matchOrigin(allowed, "http://localhost:3000")).toBe(true);
});

test("wildcard matches one label", () => {
  expect(matchOrigin(allowed, "https://orderloom-abc123.vercel.app")).toBe(true);
  expect(matchOrigin(allowed, "https://orderloom-git-main-abhay.vercel.app")).toBe(true);
});

test("wildcard does not span dots", () => {
  expect(matchOrigin(allowed, "https://a.b.vercel.app")).toBe(false);
});

test("wildcard does not match the bare suffix", () => {
  expect(matchOrigin(allowed, "https://vercel.app")).toBe(false);
  expect(matchOrigin(allowed, "https://.vercel.app")).toBe(false);
});

test("attacker cannot smuggle the suffix via path or subdomain trickery", () => {
  expect(matchOrigin(allowed, "https://evil.com/.vercel.app")).toBe(false);
  expect(matchOrigin(allowed, "https://evilvercel.app")).toBe(false);
  expect(matchOrigin(allowed, "http://orderloom-abc.vercel.app")).toBe(false); // wrong scheme
});

test("unrelated origins are rejected", () => {
  expect(matchOrigin(allowed, "https://evil.example")).toBe(false);
  expect(matchOrigin(allowed, "https://orderloom.abhayymishraa.com.evil.com")).toBe(false);
});
