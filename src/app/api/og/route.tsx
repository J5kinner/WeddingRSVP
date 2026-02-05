import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const inviteCode = searchParams.get('inviteCode')

        const fontData = await fetch(
            new URL('/fonts/CormorantGaramond-SemiBoldItalic.ttf', req.url)
        ).then((res) => res.arrayBuffer())

        const imageUrl = new URL('/OG.png', req.url).toString()

        let guestNames = ''
        if (inviteCode && process.env.DATABASE_URL) {
            try {
                const sql = neon(process.env.DATABASE_URL)
                const inviteRows = await sql`
          SELECT id FROM invites WHERE "inviteCode" = ${inviteCode} LIMIT 1
        `
                if (inviteRows.length > 0) {
                    const guestRows = await sql`
            SELECT name FROM guests WHERE "inviteId" = ${inviteRows[0].id}
          `
                    if (guestRows.length > 0) {
                        const names = guestRows.map(g => g.name)
                        if (names.length === 1) {
                            guestNames = names[0]
                        } else if (names.length === 2) {
                            guestNames = `${names[0]} & ${names[1]}`
                        } else {
                            guestNames = `${names[0]}, ${names[1]} & others`
                        }
                    }
                }
            } catch (e) {
                console.error('Error fetching names for OG:', e)
            }
        }

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        backgroundColor: '#F6F2EA',
                    }}
                >
                    {/* Background Image - Full Size */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={imageUrl}
                        alt="Background"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center top',
                        }}
                    />

                    {/* Bottom Text Section (35%) */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '23%',
                            backgroundColor: '#F6F2EA',
                            padding: '20px',
                            fontFamily: '"CormorantGaramond", serif',
                        }}
                    >
                        <div
                            style={{
                                fontSize: 64,
                                fontStyle: 'italic',
                                color: '#1a1a1a',
                                marginBottom: 8,
                                lineHeight: 1,
                            }}
                        >
                            Olivia & Jonah
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                marginBottom: guestNames ? 12 : 0,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 16,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.15em',
                                    color: '#666',
                                }}
                            >
                                Wedding Invitation
                            </span>
                            <span style={{ color: '#ccc' }}>|</span>
                            <span
                                style={{
                                    fontSize: 16,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.15em',
                                    color: '#666',
                                }}
                            >
                                18 May 2026
                            </span>
                        </div>

                        {guestNames && (
                            <div
                                style={{
                                    marginTop: 10,
                                    paddingTop: 10,
                                    borderTop: '1px solid #e0e0e0',
                                    fontSize: 24,
                                    fontStyle: 'italic',
                                    color: '#5B6F55',
                                }}
                            >
                                For {guestNames}
                            </div>
                        )}
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
                fonts: [
                    {
                        name: 'CormorantGaramond',
                        data: fontData,
                        style: 'italic',
                        weight: 600,
                    },
                ],
            }
        )
    } catch (e: unknown) {
        console.error(e)
        const errorMessage = e instanceof Error ? e.message : String(e)
        return new Response(`Failed to generate the image: ${errorMessage}`, {
            status: 500,
        })
    }
}
