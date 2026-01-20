// GuestStatus enum is removed as we switched to boolean isAttending

export interface GuestResponse {
  id: string;
  name: string;
  isAttending: boolean | null;
  dietaryRequirements: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InviteResponse {
  id: string;
  inviteCode: string;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  guests: GuestResponse[];
}
