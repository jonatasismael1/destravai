// Corrige a duração de um MP4 gerado pelo MediaRecorder.
//
// PROBLEMA: o MediaRecorder produz MP4 FRAGMENTADO (fMP4). O cabeçalho do filme
// (moov → mvhd/tkhd/mdhd/mehd) costuma sair com duração 0 ou só do primeiro
// fragmento. Players "estritos" (Instagram, WhatsApp, galeria) leem essa duração
// e CORTAM o vídeo (mostra só ~3-4s), mesmo o arquivo tendo todo o conteúdo —
// por isso ele toca inteiro no navegador, mas trunca ao subir pro Instagram.
//
// SOLUÇÃO: reescrever os campos de duração com a duração REAL (medida durante a
// gravação). É só edição de metadados — não re-codifica, não perde qualidade.
//
// SEGURANÇA: se a estrutura não for a esperada, devolvemos o blob ORIGINAL sem
// alterar nada. Nunca corrompe o arquivo.

export async function fixMp4Duration(blob: Blob, durationSec: number): Promise<Blob> {
  try {
    if (!(durationSec > 0) || !/mp4/i.test(blob.type)) return blob

    const buf = await blob.arrayBuffer()
    const view = new DataView(buf)
    const u8 = new Uint8Array(buf)

    const readType = (off: number) =>
      String.fromCharCode(u8[off + 4], u8[off + 5], u8[off + 6], u8[off + 7])

    // Lê o tamanho da caixa (box) e o tamanho do cabeçalho (8 ou 16 bytes).
    const readBox = (off: number) => {
      let size = view.getUint32(off)
      let headerSize = 8
      if (size === 1) {
        const hi = view.getUint32(off + 8)
        const lo = view.getUint32(off + 12)
        size = hi * 2 ** 32 + lo
        headerSize = 16
      }
      return { size, headerSize }
    }

    const writeU64 = (off: number, val: number) => {
      view.setUint32(off, Math.floor(val / 2 ** 32))
      view.setUint32(off + 4, val >>> 0)
    }

    // 1) Acha o moov no nível superior.
    let moovStart = -1
    let moovEnd = -1
    for (let off = 0; off + 8 <= buf.byteLength; ) {
      const { size } = readBox(off)
      if (size < 8) break
      if (readType(off) === 'moov') { moovStart = off; moovEnd = off + size; break }
      off += size
    }
    if (moovStart < 0) return blob

    // 2) Coleta as full-boxes de duração descendo pelos containers.
    const boxes: Array<{ type: string; payloadOff: number }> = []
    const walk = (start: number, end: number) => {
      for (let off = start; off + 8 <= end; ) {
        const { size, headerSize } = readBox(off)
        if (size < 8 || off + size > end) break
        const type = readType(off)
        const payloadOff = off + headerSize
        if (type === 'mvhd' || type === 'tkhd' || type === 'mdhd' || type === 'mehd') {
          boxes.push({ type, payloadOff })
        }
        if (type === 'trak' || type === 'mdia' || type === 'mvex') {
          walk(payloadOff, off + size)
        }
        off += size
      }
    }
    walk(moovStart + readBox(moovStart).headerSize, moovEnd)

    // 3) mvhd primeiro: dá o timescale do filme (usado por tkhd e mehd).
    let movieTimescale = 0
    for (const b of boxes) {
      if (b.type !== 'mvhd') continue
      const version = view.getUint8(b.payloadOff)
      if (version === 1) {
        const tsOff = b.payloadOff + 4 + 8 + 8 // vf + creation(8) + modification(8)
        movieTimescale = view.getUint32(tsOff)
        writeU64(tsOff + 4, Math.round(durationSec * movieTimescale))
      } else {
        const tsOff = b.payloadOff + 4 + 4 + 4 // vf + creation(4) + modification(4)
        movieTimescale = view.getUint32(tsOff)
        view.setUint32(tsOff + 4, Math.round(durationSec * movieTimescale) >>> 0)
      }
    }
    if (!movieTimescale) return blob

    // 4) tkhd / mdhd / mehd.
    for (const b of boxes) {
      const version = view.getUint8(b.payloadOff)
      if (b.type === 'tkhd') {
        const dur = Math.round(durationSec * movieTimescale)
        if (version === 1) writeU64(b.payloadOff + 4 + 8 + 8 + 4 + 4, dur)
        else view.setUint32(b.payloadOff + 4 + 4 + 4 + 4 + 4, dur >>> 0)
      } else if (b.type === 'mdhd') {
        if (version === 1) {
          const tsOff = b.payloadOff + 4 + 8 + 8
          const ts = view.getUint32(tsOff)
          writeU64(tsOff + 4, Math.round(durationSec * ts))
        } else {
          const tsOff = b.payloadOff + 4 + 4 + 4
          const ts = view.getUint32(tsOff)
          view.setUint32(tsOff + 4, Math.round(durationSec * ts) >>> 0)
        }
      } else if (b.type === 'mehd') {
        const dur = Math.round(durationSec * movieTimescale)
        if (version === 1) writeU64(b.payloadOff + 4, dur)
        else view.setUint32(b.payloadOff + 4, dur >>> 0)
      }
    }

    return new Blob([buf], { type: blob.type })
  } catch {
    return blob // qualquer imprevisto → arquivo original intacto
  }
}
