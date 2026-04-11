// src/types.ts

export interface Review {
    type: 'positive' | 'negative';
    from: string;
    comment: string;
    date: string;
  }
  
  export interface Breeder {
    id: string;
    name: string;
    location: string;
    selling: string;
    category: string;
    verified: boolean;
    founding_breeder?: number | null;
    contact_link: string | null;
    info_link: string | null;
    updated: string;
    featured: boolean;
    reviews: Review[];
    logo?: string | null;
    images?: string[];
    ownerUid?: string | null;
    status?: 'published' | 'draft';
  }
  export interface FirestoreMember {
    profile: {
      businessName: string;
      memberType: string;
      town: string;
      contactEmail: string;
      website: string;
    };
    offerings: {
      description: string;
      searchTags: string[];
    };
    media: {
      logoUrl: string | null;
      galleryUrls: string[];
    };
    account: {
      ownerUid: string | null;
      status: 'published' | 'draft';
      isVerified: boolean;
      foundingMember: number | null;
      updatedAt: any; 
    };
  }
  
  export interface DirectoryData {
    directory_info: Breeder[];
  }

  export interface ResponseError {
    error: string;
  }

  export interface InquiryThread {
    id: string; // generated: `${userUid}_${breederSlug}`
    participants: string[]; // [userUid, breederOwnerUid]
    type?: 'inquiry' | 'support' | 'direct';
    userUid: string;
    userName?: string;
    breederSlug: string;
    breederName: string;
    lastMessage: string;
    updatedAt: any; // ServerTimestamp
    unreadCount: Record<string, number>; // { [uid]: count }
  }

  export interface InquiryMessage {
    id?: string;
    senderUid: string;
    text: string;
    createdAt: any; // ServerTimestamp
    read: boolean;
    // Safety & Moderation
    flaggedByUid?: string | null; 
    adminReviewStatus?: 'pending' | 'hidden' | 'approved';
  }
