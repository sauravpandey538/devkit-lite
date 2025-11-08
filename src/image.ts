export function generateImg(
  id: number = Math.floor(Math.random() * 1000),
  width: number = 400,
  height: number = 300
): string {
  // Using picsum.photos
  return `https://picsum.photos/id/${id}/${width}/${height}`;
}
