/**
 * Décode un fichier texte en gérant les BOM courants des exports bancaires.
 * Les exports Bankin' sont en UTF-16 LE ; on tombe sur UTF-8 par défaut.
 */
export function decodeTextFile(bytes: Uint8Array): string {
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder("utf-16le").decode(bytes);
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder("utf-16be").decode(bytes);
    }
  }
  return new TextDecoder("utf-8").decode(bytes);
}
