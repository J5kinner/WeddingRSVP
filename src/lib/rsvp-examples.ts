import { prisma } from '@/lib/prisma'

// Example: How to use Neon with Prisma for RSVP tracking

// 1. Create a new RSVP
export async function createRSVP(data: {
  name: string
  email: string
  attending: boolean
  numberOfGuests?: number
  dietaryNotes?: string
  message?: string
}) {
  return await prisma.rSVP.create({
    data: {
      name: data.name,
      email: data.email,
      attending: data.attending,
      numberOfGuests: data.numberOfGuests || 1,
      dietaryNotes: data.dietaryNotes,
      message: data.message,
    },
  })
}

// 2. Get all RSVPs
export async function getAllRSVPs() {
  return await prisma.rSVP.findMany({
    orderBy: { respondedAt: 'desc' },
  })
}

// 3. Get only attending guests
export async function getAttendingGuests() {
  return await prisma.rSVP.findMany({
    where: { attending: true },
    orderBy: { name: 'asc' },
  })
}

// 4. Get total number of attending guests
export async function getTotalAttendingCount() {
  const attendingRSVPs = await prisma.rSVP.findMany({
    where: { attending: true },
    select: { numberOfGuests: true },
  })
  
  return attendingRSVPs.reduce((sum, rsvp) => sum + rsvp.numberOfGuests, 0)
}

// 5. Update an RSVP (if someone changes their mind)
export async function updateRSVP(email: string, data: {
  attending?: boolean
  numberOfGuests?: number
  dietaryNotes?: string
  message?: string
}) {
  return await prisma.rSVP.update({
    where: { email },
    data,
  })
}

// 6. Check if someone has already RSVP'd
export async function hasRSVPed(email: string) {
  const rsvp = await prisma.rSVP.findUnique({
    where: { email },
  })
  return rsvp !== null
}

