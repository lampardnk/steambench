'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { RoomSummary } from '@/lib/backend'

// The room's Steam sign-in, rendered from the QR the server decoded out of the
// video. The code Steam draws expires after about a minute and then blurs
// behind a reload button; the server notices and clicks reload, so this panel
// just shows whatever code is currently valid.
export function SteamLogin({ room }: { room: RoomSummary }) {
  const [dataUrl, setDataUrl] = useState('')
  const [age, setAge] = useState(0)
  const url = room.loginQr?.url || ''

  useEffect(() => {
    if (!url) {
      setDataUrl('')
      return
    }
    QRCode.toDataURL(url, { width: 320, margin: 2, errorCorrectionLevel: 'M' })
      .then(setDataUrl)
      .catch(() => setDataUrl(''))
  }, [url])

  useEffect(() => {
    const t = setInterval(() => setAge(room.loginQr ? Math.round((Date.now() - room.loginQr.at) / 1000) : 0), 1000)
    return () => clearInterval(t)
  }, [room.loginQr])

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
      <div className="font-medium">Sign in to Steam for this room</div>
      <div className="mt-3 flex flex-wrap items-start gap-5">
        <div className="flex flex-col items-center gap-2">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="Steam sign-in QR code" className="size-44 rounded bg-white p-1" />
          ) : (
            <div className="flex size-44 items-center justify-center rounded border border-dashed border-amber-400 text-xs text-muted-foreground">
              {room.frames > 0 ? 'waiting for a fresh code…' : 'waiting for video…'}
            </div>
          )}
          <div className="text-[11px] text-muted-foreground">{room.loginQr ? `code is ${age}s old` : 'the server refreshes it automatically'}</div>
        </div>
        <div className="flex-1 space-y-2 text-muted-foreground">
          <p>
            Scan this with the Steam mobile app, or <strong>open the link below on your phone</strong> to jump straight into the app.
          </p>
          {url && (
            <div className="flex flex-wrap items-center gap-2">
              <a href={url} target="_blank" rel="noreferrer" className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                open in Steam app
              </a>
              <button onClick={() => navigator.clipboard?.writeText(url)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                copy link
              </button>
              <code className="text-[11px] break-all">{url}</code>
            </div>
          )}
          <p className="text-xs">
            This login lives only inside this room. Once it succeeds steambench saves it and every future room starts already signed in, so you should only
            ever do this once.
            {room.loginQr && room.loginQr.reloads > 0 ? ` The code has been refreshed ${room.loginQr.reloads} time${room.loginQr.reloads > 1 ? 's' : ''} for you.` : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
