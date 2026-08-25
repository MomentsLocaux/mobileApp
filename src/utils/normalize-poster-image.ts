import * as ImageManipulator from 'expo-image-manipulator';

export type NormalizedPosterImage = {
  uri: string;
  mimeType: 'image/jpeg';
  ext: 'jpg';
};

/**
 * Convert any picked/captured image to JPEG so OpenAI vision accepts it.
 * iOS camera/library often returns HEIC, which OpenAI rejects (`invalid_image_format`).
 */
export async function normalizePosterImageForVision(localUri: string): Promise<NormalizedPosterImage> {
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 2048 } }],
    {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return {
    uri: result.uri,
    mimeType: 'image/jpeg',
    ext: 'jpg',
  };
}
