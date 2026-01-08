export interface TokenProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: {
    type?: string;
    label?: string;
    url: string;
  }[];
}

export interface TokenBoost {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: {
    type?: string;
    label?: string;
    url: string;
  }[];
  totalAmount?: number;
}

export interface Pair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
  info?: {
    imageUrl?: string;
    header?: string;
    socials?: {
      type: string;
      url: string;
    }[];
    websites?: {
      label: string;
      url: string;
    }[];
  };
  boosts?: {
    active: number;
  };
  mappedIcon?: string;
}

export interface SearchResponse {
  schemaVersion: string;
  pairs: Pair[];
}

const BASE_URL = 'https://api.dexscreener.com';

export const dexscreenerApi = {
  getLatestTokenProfiles: async (): Promise<TokenProfile[]> => {
    try {
      const response = await fetch(`${BASE_URL}/token-profiles/latest/v1`);
      if (!response.ok) return [];
      return response.json();
    } catch (error) {
      console.error("Error fetching token profiles:", error);
      return [];
    }
  },

  getTopTokenBoosts: async (): Promise<TokenBoost[]> => {
    try {
      const response = await fetch(`${BASE_URL}/token-boosts/top/v1`);
      if (!response.ok) return [];
      return response.json();
    } catch (error) {
      console.error("Error fetching token boosts:", error);
      return [];
    }
  },

  // Fetch pairs by token addresses using the standard latest/dex endpoint
  getPairsByTokenAddresses: async (addresses: string[]): Promise<Pair[]> => {
    if (addresses.length === 0) return [];
    
    // Deduplicate addresses
    const uniqueAddresses = [...new Set(addresses)];
    const chunks = [];
    // DexScreener allows up to 30 addresses per call
    for (let i = 0; i < uniqueAddresses.length; i += 30) {
      chunks.push(uniqueAddresses.slice(i, i + 30));
    }

    const results: Pair[] = [];
    for (const chunk of chunks) {
      try {
        const response = await fetch(`${BASE_URL}/latest/dex/tokens/${chunk.join(',')}`);
        if (response.ok) {
          const data = await response.json();
          if (data.pairs && Array.isArray(data.pairs)) {
            results.push(...data.pairs);
          }
        }
      } catch (error) {
        console.error("Error fetching pairs chunk:", error);
      }
    }
    return results;
  },

  // New function to get a rich list of trending Solana tokens
  getTrendingSolanaPairs: async (): Promise<Pair[]> => {
    try {
      // 1. Fetch Boosts, Profiles, and Search in parallel to maximize coverage
      const [boosts, profiles, searchResults] = await Promise.all([
        dexscreenerApi.getTopTokenBoosts(),
        dexscreenerApi.getLatestTokenProfiles(),
        dexscreenerApi.searchPairs('solana')
      ]);

      // 2. Filter for Solana and extract addresses + icon maps
      const addressMap = new Map<string, string>(); // address -> icon url

      boosts.filter(b => b.chainId === 'solana').forEach(b => {
        addressMap.set(b.tokenAddress, b.icon || '');
      });
      
      profiles.filter(p => p.chainId === 'solana').forEach(p => {
        if (!addressMap.has(p.tokenAddress)) {
           addressMap.set(p.tokenAddress, p.icon || '');
        }
      });

      searchResults.filter(p => p.chainId === 'solana').forEach(p => {
        if (!addressMap.has(p.baseToken.address)) {
           addressMap.set(p.baseToken.address, p.info?.imageUrl || '');
        }
      });

      // 3. Fetch full pair data for collected addresses
      const addresses = Array.from(addressMap.keys());
      const fetchedPairs = await dexscreenerApi.getPairsByTokenAddresses(addresses);

      // 4. Enrich pairs with icons if missing
      return fetchedPairs.map(pair => {
        const mappedIcon = addressMap.get(pair.baseToken.address);
        return {
          ...pair,
          mappedIcon: mappedIcon || pair.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/solana/${pair.baseToken.address}.png`
        };
      });

    } catch (error) {
      console.error("Error in getTrendingSolanaPairs:", error);
      return [];
    }
  },

  // New function to get new pairs based on latest profiles
  
  // Fetch all Solana tokens from Jupiter API
  getAllSolanaTokens: async (): Promise<any[]> => {
    try {
      const response = await fetch('https://token.jup.ag/all');
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error("Error fetching Jupiter token list:", error);
      return [];
    }
  },

  getNewSolanaPairs: async (): Promise<Pair[]> => {
    try {
      const profiles = await dexscreenerApi.getLatestTokenProfiles();
      const solanaProfiles = profiles.filter(p => p.chainId === 'solana');
      
      const addressMap = new Map<string, string>();
      solanaProfiles.forEach(p => {
        addressMap.set(p.tokenAddress, p.icon || '');
      });

      const addresses = Array.from(addressMap.keys());
      const pairs = await dexscreenerApi.getPairsByTokenAddresses(addresses);

      return pairs.map(pair => {
         const mappedIcon = addressMap.get(pair.baseToken.address);
         return {
           ...pair,
           mappedIcon: mappedIcon || pair.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/solana/${pair.baseToken.address}.png`
         };
      }).sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));

    } catch (error) {
      console.error("Error in getNewSolanaPairs:", error);
      return [];
    }
  },

  searchPairs: async (query: string): Promise<Pair[]> => {
    const response = await fetch(`${BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search pairs');
    const data: SearchResponse = await response.json();
    // Filter for Solana pairs only as requested
    return data.pairs.filter(pair => pair.chainId === 'solana');
  },
  
  getSolanaPairs: async (pairId: string): Promise<Pair | null> => {
     const response = await fetch(`${BASE_URL}/latest/dex/pairs/solana/${pairId}`);
     if (!response.ok) return null; // Handle error gracefully
     const data = await response.json();
     return data.pair || null;
  }
};
