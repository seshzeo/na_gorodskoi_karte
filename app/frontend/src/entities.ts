export type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
};

export type ModeratorCategory = Category & {
  is_active: boolean;
  is_builtin: boolean;
};

export type Point = {
  id: number;
  title: string;
  description: string;
  category_id: number;
  category_name: string;
  latitude: number;
  longitude: number;
  event_at: string;
  author_name: string;
  created_at: string;
  updated_at: string;
};

export type ModeratorPoint = Point & {
  is_active: boolean;
};

export type PointRequest = {
  author_name: string;
  title: string;
  description: string;
  category_id: number;
  latitude: number;
  longitude: number;
  event_at: string;
};

export type Moderator = {
  id: string;
  username: string;
};

export type LoginResponse = Moderator & {
  csrf_token: string;
};

export type PointRequestStatus = "pending" | "approved" | "rejected";

export type PointRequestRead = PointRequest & {
  id: number;
  status: PointRequestStatus;
  created_at: string;
  updated_at: string;
  moderated_at: string | null;
  moderated_by: string | null;
  moderation_reason: string | null;
  point_id: number | null;
};
