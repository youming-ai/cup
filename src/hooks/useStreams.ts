import { useState, useEffect, useCallback } from 'react';
import { Match, Channel, Substream } from '../types';
import { slugify } from '../utils/helpers';

interface APISportsSubstream {
  id: number;
  name: string;
  tag: string;
  source_tag: string;
  locale: string;
  iframe: string;
}

interface APISportsStream {
  id: number;
  name: string;
  category_name?: string;
  iframe: string;
  viewers?: string;
  substreams?: APISportsSubstream[];
}

interface APISportsCategory {
  category?: string;
  streams?: APISportsStream[];
}

interface APISportsEnvelope {
  streams?: APISportsCategory[];
}

interface APITVStream {
  channel?: string;
  title?: string;
  url?: string;
}

interface APITVChannel {
  id: string;
  logo?: string;
  categories?: string[];
}

export function useStreams() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Sports Streams (CORS-friendly)
      const sportsRes = await fetch('https://api.ppv.to/api/streams');
      if (!sportsRes.ok) throw new Error('Failed to fetch sports streams');
      const sportsData = (await sportsRes.json()) as APISportsCategory[] | APISportsEnvelope;
      
      const flatMatches: Match[] = [];
      const categories = Array.isArray(sportsData)
        ? sportsData
        : (sportsData && typeof sportsData === 'object' && 'streams' in sportsData && Array.isArray(sportsData.streams)
          ? sportsData.streams
          : []);

      categories.forEach((cat: APISportsCategory) => {
        if (cat.streams && Array.isArray(cat.streams)) {
          cat.streams.forEach((s: APISportsStream) => {
            const mappedSubstreams: Substream[] = (s.substreams || []).map((sub) => ({
              id: sub.id,
              name: sub.name,
              tag: sub.tag,
              source_tag: sub.source_tag,
              locale: sub.locale,
              iframe: sub.iframe,
            }));

            flatMatches.push({
              id: s.id,
              name: s.name,
              category_name: s.category_name || cat.category || 'Other',
              iframe: s.iframe,
              viewers: s.viewers || '0',
              substreams: mappedSubstreams,
              slug: slugify(s.name),
            });
          });
        }
      });
      setMatches(flatMatches);

      // 2. Fetch TV Streams and Channel Metadata
      const [tvStreamsRes, tvChannelsRes] = await Promise.all([
        fetch('https://iptv-org.github.io/api/streams.json'),
        fetch('https://iptv-org.github.io/api/channels.json'),
      ]);

      if (!tvStreamsRes.ok || !tvChannelsRes.ok) {
        throw new Error('Failed to fetch TV channels data');
      }

      const tvStreams = (await tvStreamsRes.json()) as APITVStream[];
      const tvChannels = (await tvChannelsRes.json()) as APITVChannel[];

      // Create a map for quick lookups of channel meta
      const channelMap = new Map<string, { logo: string; category: string }>();
      tvChannels.forEach((ch) => {
        if (ch && typeof ch.id === 'string') {
          channelMap.set(ch.id, {
            logo: ch.logo || '',
            category: (ch.categories && ch.categories[0]) || 'General',
          });
        }
      });

      const processedChannels: Channel[] = tvStreams
        .filter((stream): stream is APITVStream & { url: string } => 
          typeof stream.url === 'string' && stream.url.endsWith('.m3u8')
        )
        .map((stream) => {
          const channelId = stream.channel || '';
          const meta = channelMap.get(channelId) || { logo: '', category: 'General' };
          return {
            channel: channelId,
            title: stream.title || 'Unnamed Channel',
            url: stream.url,
            logo: meta.logo,
            category: meta.category,
            slug: slugify(stream.title || ''),
          };
        });

      setChannels(processedChannels);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return { matches, channels, loading, error, refetch: fetchAllData };
}
