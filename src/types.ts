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
    facebookUid?: string | null;
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
      facebookUid: string | null;
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
