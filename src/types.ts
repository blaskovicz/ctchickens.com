// src/types.ts

export interface Review {
    type: 'positive' | 'negative';
    from: string;
    comment: string;
    date: string;
  }
  
  // LEGACY Interface (Used by UI Components)
  export interface Breeder {
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
  }

  // V2 Schema (Firestore directory_members)
  export interface FirestoreMember {
    id: string; // The Slug (Doc ID)
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
      isFoundingMember: boolean;
      foundingMember: number | null;
      updatedAt: any; // Firestore Timestamp
    };
  }
  
  export interface DirectoryData {
    directory_info: Breeder[];
  }

  export interface ResponseError {
    error: string;
  }
