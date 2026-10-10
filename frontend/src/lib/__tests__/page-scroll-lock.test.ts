import { afterEach, describe, expect, it } from "vitest";
import { lockPageScroll } from "@/lib/page-scroll-lock";

const overflow = () => document.documentElement.style.overflow;

describe("lockPageScroll", () => {
  afterEach(() => {
    document.documentElement.style.overflow = "";
  });

  it("locks the page on <html>, never on <body>, and releases it", () => {
    const unlock = lockPageScroll();
    expect(overflow()).toBe("hidden");
    expect(document.body.style.overflow).toBe("");
    unlock();
    expect(overflow()).toBe("");
  });

  it("keeps the page locked until the last of several sheets closes", () => {
    const unlockShare = lockPageScroll();
    const unlockSignIn = lockPageScroll();
    unlockSignIn();
    expect(overflow()).toBe("hidden");
    unlockShare();
    expect(overflow()).toBe("");
  });

  it("counts a release called twice only once", () => {
    const unlockShare = lockPageScroll();
    const unlockSignIn = lockPageScroll();
    unlockSignIn();
    unlockSignIn();
    expect(overflow()).toBe("hidden");
    unlockShare();
    expect(overflow()).toBe("");
  });
});
