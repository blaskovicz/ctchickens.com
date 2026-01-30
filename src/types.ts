// src/types.ts

export interface Review {
    type: 'positive' | 'negative';
    from: string;
    comment: string;
    date: string;
  }
  
  export interface Breeder {
    name: string;
    location: string;
    selling: string;
    verified: boolean;
    founding_breeder?: number; // Optional since not everyone has it
    contact_link: string | null;
    info_link: string | null;
    updated: string;
    featured: boolean;
    reviews: Review[];
  }
  
  export interface DirectoryData {
    directory_info: Breeder[];
  }