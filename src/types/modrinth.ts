export type DependencyType = 'required' | 'optional' | 'incompatible' | 'embedded';
export type VersionType = 'release' | 'beta' | 'alpha';
export type ProjectType = 'mod' | 'modpack' | 'resourcepack' | 'shader' | 'datapack';

export interface ModSearchHit {
  project_id: string;
  project_type: ProjectType;
  slug: string;
  author: string;
  title: string;
  description: string;
  categories: string[];
  display_categories?: string[];
  versions: string[];
  downloads: number;
  follows: number;
  icon_url?: string;
  date_created: string;
  date_modified: string;
  latest_version?: string;
}

export interface SearchResponse {
  hits: ModSearchHit[];
  offset: number;
  limit: number;
  total_hits: number;
}

export interface ModVersionFile {
  hashes: {
    sha1: string;
    sha512: string;
  };
  url: string;
  filename: string;
  primary: boolean;
  size: number;
  file_type?: string | null;
}

export interface ModDependency {
  version_id: string | null;
  project_id: string | null;
  file_name?: string | null;
  dependency_type: DependencyType;
}

export interface ModVersion {
  id: string;
  project_id: string;
  author_id: string;
  featured: boolean;
  name: string;
  version_number: string;
  changelog?: string;
  dependencies: ModDependency[];
  game_versions: string[];
  version_type: VersionType;
  loaders: string[];
  featured_gallery_image?: string;
  files: ModVersionFile[];
  date_published: string;
  downloads: number;
}

export interface ModProject {
  id: string;
  slug: string;
  project_type: ProjectType;
  title: string;
  description: string;
  body?: string;
  categories: string[];
  additional_categories?: string[];
  downloads: number;
  followers: number;
  versions: string[];
  icon_url?: string;
}

export interface FilterOptions {
  gameVersion?: string;
  loader?: string;
  projectType?: ProjectType;
  environment?: 'client' | 'server';
}
