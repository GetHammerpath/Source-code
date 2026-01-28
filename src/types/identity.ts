export type Avatar = {
  id: string;
  user_id: string;
  name: string;
  seed_image_url: string;
  voice_id: string | null;
  created_at: string;
};

export type Video = {
  id: string;
  user_id: string;
  avatar_id: string;
  created_at: string;
};

export type GenerateAvatarRequest = {
  prompt: string;
};

export type GenerateAvatarResponse = {
  urls: string[];
};

