export interface GuestResponse {
  id: string;
  name: string;
  status: boolean;
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
