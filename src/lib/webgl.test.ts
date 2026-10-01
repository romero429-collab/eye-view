import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyGpu } from "./webgl.ts";

describe("webgl", () => {
  it("treats software renderers as the failsafe case", () => {
    assert.equal(classifyGpu("Google SwiftShader"), "weak");
    assert.equal(classifyGpu("llvmpipe (LLVM 15.0.7, 256 bits)"), "weak");
    assert.equal(classifyGpu("ANGLE (Apple, Apple M2, OpenGL 4.1)"), "hardware");
  });
});
