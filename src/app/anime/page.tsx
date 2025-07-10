
'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  searchAnime,
  getAnimeDetails,
  getEpisodeSources,
  type AnimeSearchResult,
  type AnimeDetails,
  type EpisodeSource,
} from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader, Search, Film, Download, ArrowLeft, Tv, Clapperboard } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AnimePage() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AnimeSearchResult[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<AnimeDetails | null>(null);
  const [episodeSources, setEpisodeSources] = useState<EpisodeSource[]>([]);
  
  const [searchLoading, setSearchLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [sourceCategory, setSourceCategory] = useState<'sub' | 'dub'>('sub');

  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setSearchLoading(true);
    setSelectedAnime(null);
    setSearchResults([]);
    setEpisodeSources([]);

    try {
      const results = await searchAnime(query);
      setSearchResults(results);
      if (results.length === 0) {
        toast({ title: 'No Results', description: 'No anime found for your query.' });
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Search Failed', description: 'Could not fetch search results.', variant: 'destructive' });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectAnime = async (animeId: string) => {
    setDetailsLoading(true);
    setSelectedAnime(null);
    setEpisodeSources([]);
    setSelectedEpisodeId(null);
    
    try {
      const details = await getAnimeDetails(animeId);
      setSelectedAnime(details);
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to Load Details', description: 'Could not fetch anime details.', variant: 'destructive' });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleGetSources = async (episodeId: string) => {
    setSelectedEpisodeId(episodeId);
    setSourcesLoading(true);
    setEpisodeSources([]);

    try {
      const sources = await getEpisodeSources(episodeId, sourceCategory);
      setEpisodeSources(sources);
      if (sources.length === 0) {
         toast({ title: 'No Links Found', description: `Could not find ${sourceCategory} links for this episode.` });
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to Load Links', description: 'Could not fetch download links.', variant: 'destructive' });
    } finally {
      setSourcesLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-background font-body">
      <div className="absolute top-4 left-4">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2" /> Back to Home
          </Link>
        </Button>
      </div>

      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left Column: Search and Results */}
        <Card className="shadow-2xl rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-3xl font-headline">
              <Film /> Anime Downloader
            </CardTitle>
            <CardDescription>Search for an anime to get its details and download links.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Naruto"
                className="bg-muted/50"
              />
              <Button type="submit" disabled={searchLoading}>
                {searchLoading ? <Loader className="animate-spin" /> : <Search />}
              </Button>
            </form>

            <ScrollArea className="h-[50vh] pr-4">
              <div className="space-y-4">
                {searchResults.map((anime) => (
                  <Card
                    key={anime.id}
                    onClick={() => handleSelectAnime(anime.id)}
                    className="flex gap-4 p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <Image
                      src={anime.poster}
                      alt={anime.name}
                      width={80}
                      height={120}
                      className="rounded-md object-cover"
                    />
                    <div className="flex flex-col justify-center">
                      <h3 className="font-semibold">{anime.name}</h3>
                      <div className="flex gap-2 mt-2">
                        {anime.dub > 0 && <Badge variant="secondary">DUB: {anime.dub}</Badge>}
                        {anime.sub > 0 && <Badge variant="secondary">SUB: {anime.sub}</Badge>}
                        <Badge variant="outline" className="capitalize">{anime.type}</Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Column: Details and Downloads */}
        <Card className="shadow-2xl rounded-2xl sticky top-8">
           <CardHeader>
                <CardTitle>Details</CardTitle>
                <CardDescription>Select an anime to see its details here.</CardDescription>
            </CardHeader>
            <CardContent>
                {detailsLoading && <div className="flex justify-center items-center h-64"><Loader className="animate-spin h-8 w-8" /></div>}
                
                {selectedAnime && !detailsLoading && (
                    <ScrollArea className="h-[70vh] pr-4">
                        <div className="flex flex-col gap-4">
                             <Image
                                src={selectedAnime.poster}
                                alt={selectedAnime.name}
                                width={150}
                                height={220}
                                className="rounded-lg object-cover self-center shadow-lg"
                                />
                            <h2 className="text-2xl font-bold text-center">{selectedAnime.name}</h2>
                            <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: selectedAnime.description }} />
                            
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <p><strong>Rating:</strong> {selectedAnime.stats.rating}</p>
                                <p><strong>Duration:</strong> {selectedAnime.stats.duration}</p>
                                <p><strong>Type:</strong> {selectedAnime.stats.type}</p>
                                <p><strong>Episodes:</strong> {selectedAnime.stats.episodes.dub ? `Dub: ${selectedAnime.stats.episodes.dub}` : ''} {selectedAnime.stats.episodes.sub ? `Sub: ${selectedAnime.stats.episodes.sub}` : ''}</p>
                            </div>
                            
                            <div className='flex items-center gap-4'>
                                <h3 className="font-semibold mt-4">Episodes</h3>
                                 <Select value={sourceCategory} onValueChange={(value) => setSourceCategory(value as 'sub' | 'dub')}>
                                    <SelectTrigger className="w-[120px] mt-4">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sub">Subbed</SelectItem>
                                        <SelectItem value="dub">Dubbed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {selectedAnime.episodes.map(ep => (
                                    <Button key={ep.episodeId} variant={selectedEpisodeId === ep.episodeId ? "default" : "outline"} onClick={() => handleGetSources(ep.episodeId)}>
                                        {`Ep ${ep.number}: ${ep.title}`}
                                    </Button>
                                ))}
                            </div>

                            {sourcesLoading && <div className="flex justify-center items-center p-4"><Loader className="animate-spin" /></div>}

                            {episodeSources.length > 0 && !sourcesLoading && (
                                <div className="mt-4 space-y-2">
                                    <h4 className="font-semibold">Download Links:</h4>
                                    {episodeSources.map((source, index) => (
                                        <a href={source.url} key={index} download>
                                            <Button variant="secondary" className="w-full justify-between">
                                                <span>{source.quality || 'Default'} (MP4)</span>
                                                <Download />
                                            </Button>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>

      </div>
    </main>
  );
}
