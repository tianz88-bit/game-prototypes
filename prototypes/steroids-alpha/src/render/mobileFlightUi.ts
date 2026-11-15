/** Small persistent header; secondary information is opened one panel at a time. */
export function mobileHeader(w: number) {
  const tight = w < 600, gap = tight ? 6 : 8;
  const warpW = tight ? 76 : 100, boardW = tight ? 44 : 76, shopW = tight ? 60 : 110;
  const right = w - 12;
  return {
    tight,
    warp: { x: right-warpW/2, y: 30, w: warpW, h: 36 },
    board: { x: right-warpW-gap-boardW/2, y: 30, w: boardW, h: 36 },
    shop: { x: right-warpW-gap-boardW-gap-shopW/2, y: 30, w: shopW, h: 36 },
    drawer: { x: w-12-Math.min(330,w-24), y: 66, w: Math.min(330,w-24) },
  };
}
