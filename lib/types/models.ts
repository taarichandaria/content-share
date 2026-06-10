import type { Database } from "@/lib/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Friendship = Database["public"]["Tables"]["friendships"]["Row"];
export type ContentItem = Database["public"]["Tables"]["content_items"]["Row"];
export type Read = Database["public"]["Tables"]["reads"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
export type ContentType = Database["public"]["Enums"]["content_type"];
export type ReadStatus = Database["public"]["Enums"]["read_status"];

export type AuthorSummary = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url"
>;

/** Feed/profile list shape: counts only, no comment bodies. */
export interface FeedPost extends Post {
  content_item: ContentItem;
  author: AuthorSummary;
  comments: { count: number }[];
}

export interface CommentWithAuthor extends Comment {
  author: AuthorSummary;
}

/** Post detail shape: full comments embedded. */
export interface PostDetail extends Post {
  content_item: ContentItem;
  author: AuthorSummary;
  comments: CommentWithAuthor[];
}

export interface ReadWithItem extends Read {
  content_item: ContentItem;
}

/** A friendship row decorated with the other participant's profile. */
export interface FriendEntry {
  friendship: Friendship;
  profile: AuthorSummary;
  /** true when the other user sent the request (we are the addressee). */
  incoming: boolean;
}

/** Draft content item produced by the composer (unfurled or manual). */
export interface NewContentItem {
  type: ContentType;
  url: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
  creator: string | null;
}
