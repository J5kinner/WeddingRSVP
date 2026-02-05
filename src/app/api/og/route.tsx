import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const runtime = 'edge'

async function loadFont(url: string) {
    const response = await fetch(url)
    return await response.arrayBuffer()
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const inviteCode = searchParams.get('inviteCode')

        const cormorantData = await loadFont(
            'https://fonts.gstatic.com/s/cormorantgaramond/v16/co3amX5sl0_tYSof0E055-yU9InPpph-Xw.ttf'
        )
        const interData = await loadFont(
            'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZg.ttf'
        )

        const images = ['laugh.jpeg', 'pose.jpeg']
        let imageIndex = 0
        if (inviteCode) {
            imageIndex = inviteCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % images.length
        } else {
            imageIndex = Math.floor(Math.random() * images.length)
        }

        const randomImage = images[imageIndex]
        const imageUrl = new URL(`/${randomImage}`, req.url).toString()

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
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#F6F2EA',
                        position: 'relative',
                    }}
                >
                    {/* Background Image */}
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
                        }}
                    />

                    {/* Overlay for readability */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(0,0,0,0.2)',
                        }}
                    />

                    {/* Text Content */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(246, 242, 234, 0.9)',
                            padding: '60px 80px',
                            borderRadius: '2px',
                            border: '1px solid rgba(0,0,0,0.05)',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
                        }}
                    >
                        <div
                            style={{
                                fontFamily: 'Cormorant',
                                fontSize: 80,
                                fontStyle: 'italic',
                                color: '#000000',
                                marginBottom: 20,
                                textAlign: 'center',
                            }}
                        >
                            Olivia & Jonah
                        </div>

                        <div
                            style={{
                                fontFamily: 'Inter',
                                fontSize: 20,
                                color: '#000000',
                                textTransform: 'uppercase',
                                letterSpacing: '0.2em',
                                opacity: 0.8,
                                marginBottom: guestNames ? 40 : 10,
                            }}
                        >
                            Wedding Invitation
                        </div>

                        {guestNames && (
                            <div
                                style={{
                                    fontFamily: 'Cormorant',
                                    fontSize: 32,
                                    fontStyle: 'italic',
                                    color: '#5B6F55',
                                    borderTop: '1px solid rgba(0,0,0,0.1)',
                                    paddingTop: 30,
                                    textAlign: 'center',
                                }}
                            >
                                For {guestNames}
                            </div>
                        )}
                    </div>

                    {/* Date Footer */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 40,
                            fontFamily: 'Inter',
                            fontSize: 14,
                            color: '#FBF9F5',
                            textTransform: 'uppercase',
                            letterSpacing: '0.4em',
                            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        }}
                    >
                        18th May 2026 • Bendooley Estate
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
                fonts: [
                    {
                        name: 'Cormorant',
                        data: cormorantData,
                        style: 'italic',
                        weight: 600,
                    },
                    {
                        name: 'Inter',
                        data: interData,
                        style: 'normal',
                        weight: 400,
                    },
                ],
            }
        )
    } catch (e: unknown) {
        console.error(e)
        return new Response(`Failed to generate the image`, {
            status: 500,
        })
    }
}
