export interface Substream {
  id: number;
  name: string;
  tag: string;
  source_tag: string;
  locale: string;
  iframe: string;
}

export interface Match {
  id: number;
  name: string;
  category_name: string;
  iframe: string;
  viewers: string;
  substreams: Substream[];
  slug: string;
}

export interface Channel {
  channel: string;
  title: string;
  url: string;
  logo: string;
  category: string;
  slug: string;
}
