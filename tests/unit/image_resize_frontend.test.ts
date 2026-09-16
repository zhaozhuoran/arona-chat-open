import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { convertImageToSdrIfPossible } from "../../frontend/src/store/useStore.ts";

// Setup global DOM mocks for testing canvas/image bitmap client-side logic
function setupCanvasAndImageBitmapMocks(options?: {
  imageWidth?: number;
  imageHeight?: number;
  createBitmapFail?: boolean;
}) {
  const imgWidth = options?.imageWidth ?? 4096;
  const imgHeight = options?.imageHeight ?? 2048;

  // Mock global ImageBitmap
  class MockImageBitmap {
    width = imgWidth;
    height = imgHeight;
    close() {}
  }
  (globalThis as any).ImageBitmap = MockImageBitmap;

  // Mock createImageBitmap
  if (options?.createBitmapFail) {
    (globalThis as any).createImageBitmap = async () => {
      throw new Error("Failed to create image bitmap");
    };
  } else {
    (globalThis as any).createImageBitmap = async () => {
      return new MockImageBitmap();
    };
  }

  // Mock HTMLCanvasElement & CanvasRenderingContext2D
  let drawnCanvasWidth = 0;
  let drawnCanvasHeight = 0;
  let drawImageArgs: any[] = [];

  class MockCanvas {
    width = 0;
    height = 0;
    getContext(type: string) {
      if (type === "2d") {
        return {
          imageSmoothingEnabled: false,
          imageSmoothingQuality: "low",
          drawImage: (...args: any[]) => {
            drawImageArgs = args;
          },
        };
      }
      return null;
    }
    toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number) {
      drawnCanvasWidth = this.width;
      drawnCanvasHeight = this.height;
      const mockBlob = new Blob(["mock-resized-image-content"], { type: type || "image/png" });
      callback(mockBlob);
    }
  }

  (globalThis as any).document = {
    createElement: (tagName: string) => {
      if (tagName === "canvas") {
        return new MockCanvas();
      }
      return {};
    },
  };

  return {
    getDrawnDimensions: () => ({ width: drawnCanvasWidth, height: drawnCanvasHeight }),
    getDrawImageArgs: () => drawImageArgs,
  };
}

describe("Frontend convertImageToSdrIfPossible with ImageResizeOptions", () => {
  test("returns original file when file is not an image", async () => {
    const textFile = new File(["hello world"], "test.txt", { type: "text/plain" });
    const result = await convertImageToSdrIfPossible(textFile, { enabled: true, maxDimension: 2048 });
    assert.strictEqual(result, textFile);
  });

  test("bypasses compression when image dimension is below threshold", async () => {
    const mocks = setupCanvasAndImageBitmapMocks({ imageWidth: 1024, imageHeight: 768 });
    const imageFile = new File(["fake-image"], "small.jpg", { type: "image/jpeg" });

    const result = await convertImageToSdrIfPossible(imageFile, { enabled: true, maxDimension: 2048 });
    assert.strictEqual(result, imageFile);
  });

  test("bypasses compression when resize options are explicitly disabled", async () => {
    const mocks = setupCanvasAndImageBitmapMocks({ imageWidth: 4096, imageHeight: 2048 });
    const imageFile = new File(["fake-image"], "large.jpg", { type: "image/jpeg" });

    const result = await convertImageToSdrIfPossible(imageFile, { enabled: false, maxDimension: 2048 });
    assert.strictEqual(result, imageFile);
  });

  test("bypasses compression for GIF and SVG animated/vector formats", async () => {
    const mocks = setupCanvasAndImageBitmapMocks({ imageWidth: 4096, imageHeight: 2048 });
    const gifFile = new File(["fake-gif"], "animated.gif", { type: "image/gif" });
    const svgFile = new File(["fake-svg"], "vector.svg", { type: "image/svg+xml" });

    const gifResult = await convertImageToSdrIfPossible(gifFile, { enabled: true, maxDimension: 2048 });
    const svgResult = await convertImageToSdrIfPossible(svgFile, { enabled: true, maxDimension: 2048 });

    assert.strictEqual(gifResult, gifFile);
    assert.strictEqual(svgResult, svgFile);
  });

  test("resizes high-resolution image proportionally when dimension exceeds maxDimension", async () => {
    const mocks = setupCanvasAndImageBitmapMocks({ imageWidth: 4096, imageHeight: 2048 });
    const largeImage = new File(["fake-large-image"], "photo.png", { type: "image/png" });

    const result = await convertImageToSdrIfPossible(largeImage, { enabled: true, maxDimension: 2048 });

    assert.notStrictEqual(result, largeImage);
    assert.strictEqual(result.name, "photo.png");
    assert.strictEqual(result.type, "image/png");

    const dimensions = mocks.getDrawnDimensions();
    // 4096 x 2048 scaled down to max dimension 2048 on long edge -> 2048 x 1024
    assert.strictEqual(dimensions.width, 2048);
    assert.strictEqual(dimensions.height, 1024);
  });

  test("preserves PNG/WebP mime type and transparency when scaling", async () => {
    const mocks = setupCanvasAndImageBitmapMocks({ imageWidth: 3000, imageHeight: 3000 });
    const webpFile = new File(["fake-webp"], "graphic.webp", { type: "image/webp" });

    const result = await convertImageToSdrIfPossible(webpFile, { enabled: true, maxDimension: 1024 });

    assert.strictEqual(result.type, "image/webp");
    const dimensions = mocks.getDrawnDimensions();
    assert.strictEqual(dimensions.width, 1024);
    assert.strictEqual(dimensions.height, 1024);
  });

  test("falls back safely to original file if createImageBitmap fails", async () => {
    setupCanvasAndImageBitmapMocks({ createBitmapFail: true });
    const imageFile = new File(["corrupted-image"], "corrupt.jpg", { type: "image/jpeg" });

    const result = await convertImageToSdrIfPossible(imageFile, { enabled: true, maxDimension: 2048 });
    assert.strictEqual(result, imageFile);
  });
});
