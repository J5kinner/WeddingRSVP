export type GuestStatus = 'ATTENDING' | 'NOT_ATTENDING' | 'UNSELECTED';

export interface GuestResponse {
  id: string;
  name: string;
  status: GuestStatus;
  dietNotes: string | null;
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
