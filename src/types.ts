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
    // 1. Identification for the backend janitor script
    gallery_folder_id?: string;
    
    // 2. The raw JSON string from the spreadsheet (Store parses this)
    image_cache_json?: string;
    
    // 3. The final processed data for components
    logo?: string | null;
    images?: string[];
  }
  
  export interface DirectoryData {
    directory_info: Breeder[];
  }

  export interface ResponseError {
    error: string;
  }