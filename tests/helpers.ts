import type { RawImage } from "../src/types";

/** 단색으로 채운 테스트 이미지 생성 */
export function solidImage(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): RawImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { width, height, data };
}

export function setPixel(
  img: RawImage,
  x: number,
  y: number,
  rgba: [number, number, number, number],
): void {
  const i = (y * img.width + x) * 4;
  img.data[i] = rgba[0];
  img.data[i + 1] = rgba[1];
  img.data[i + 2] = rgba[2];
  img.data[i + 3] = rgba[3];
}

export function getPixel(img: RawImage, x: number, y: number): [number, number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

/** 가운데 사각형만 다른 색으로 칠한 이미지 (트림 테스트용) */
export function borderedImage(
  width: number,
  height: number,
  border: number,
  bgColor: [number, number, number, number],
  fgColor: [number, number, number, number],
): RawImage {
  const img = solidImage(width, height, bgColor);
  for (let y = border; y < height - border; y++) {
    for (let x = border; x < width - border; x++) {
      setPixel(img, x, y, fgColor);
    }
  }
  return img;
}
