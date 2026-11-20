/** Touch cover screens keep the existing quarter turn; unfolded displays have room to stay upright. */
export function turnCoverScreen(w: number, h: number, touch: boolean): boolean {
  return touch && w < 500 && h > w * 1.4;
}
