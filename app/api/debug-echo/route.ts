import { NextRequest, NextResponse } from 'next/server'

// TEMPORARY debug endpoint (Milestone 2, architecture test).
// Logs + echoes whatever body it receives so we can see what format the iOS
// Shortcut serializes health samples into. No storage, no auth — DELETE once
// the thin-vs-fat Shortcut decision is made (see docs/architecture-thin-shortcut.md).

function describe(value: unknown): unknown {
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      first_item_keys:
        value.length && typeof value[0] === 'object' && value[0] !== null
          ? Object.keys(value[0] as object)
          : null,
      first_item_sample: value.length ? value[0] : null,
    }
  }
  if (value && typeof value === 'object') {
    return { type: 'object', top_level_keys: Object.keys(value as object) }
  }
  return { type: typeof value, value }
}

export async function POST(req: NextRequest) {
  const raw = await req.text()

  let parsedOk = false
  let shape: unknown = null
  try {
    const parsed = JSON.parse(raw)
    parsedOk = true
    shape = describe(parsed)
  } catch {
    parsedOk = false
  }

  const summary = {
    received_content_type: req.headers.get('content-type'),
    byte_size: raw.length,
    parsed_as_json: parsedOk,
    shape,
    raw_preview: raw.slice(0, 4000),
    truncated: raw.length > 4000,
  }

  console.log('[debug-echo]', JSON.stringify({ ...summary, raw_preview: undefined }))

  return NextResponse.json(summary)
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST any body here; it echoes content-type, size, parse status, shape, and a preview.',
  })
}
