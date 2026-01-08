import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Navigation } from '@/components/Navigation';
import { PegasusAnimation } from '@/components/PegasusAnimation';
import { dexscreenerApi } from '@/services/dexscreener';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Globe, Twitter, Send, Copy, ExternalLink, TrendingUp, DollarSign, Droplets, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

const TokenDetail = () => {
  const { pairAddress } = useParams<{ pairAddress: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: pair, isLoading } = useQuery({
    queryKey: ['pair', pairAddress],
    queryFn: () => pairAddress ? dexscreenerApi.getSolanaPairs(pairAddress) : null,
    enabled: !!pairAddress,
    refetchInterval: 30000,
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard",
    });
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '-';
    if (value < 0.0001) return '$' + value.toExponential(4);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const formatNumber = (value: number | undefined) => {
    if (value === undefined) return '-';
    if (value >= 1000000) return (value / 1000000).toFixed(2) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(2) + 'K';
    return value.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <PegasusAnimation />
        <div className="text-xl animate-pulse">Loading Token Data...</div>
      </div>
    );
  }

  if (!pair) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4">
        <Navigation />
        <h2 className="text-2xl font-bold">Token Pair Not Found</h2>
        <Button onClick={() => navigate('/launch-pad')}>Back to Launch Pad</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <PegasusAnimation />
      <Navigation />

      <div className="relative z-10 pt-24 pb-8 container mx-auto px-4 max-w-7xl">
        {/* Header / Navigation */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <Button variant="ghost" className="gap-2 pl-0 hover:bg-transparent hover:text-primary" onClick={() => navigate('/launch-pad')}>
            <ArrowLeft className="w-4 h-4" /> Back to List
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Chart & Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Token Header */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-card p-6 rounded-xl border border-white/10"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary p-0.5">
                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                         {/* We can try to construct an icon URL if not present, but usually pair.info.imageUrl or similar is needed. 
                             DexScreener API 'pair' object doesn't always have the icon URL directly in the root, 
                             sometimes it's in info. For now we use a fallback or the icon if we can find it in the API response structure 
                             (which might vary). We'll use a placeholder if null. */}
                         <span className="text-2xl font-bold text-white">{pair.baseToken.symbol[0]}</span>
                    </div>
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                    {pair.baseToken.name} <span className="text-muted-foreground text-xl">({pair.baseToken.symbol})</span>
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span className="font-mono">{pair.baseToken.address.slice(0, 6)}...{pair.baseToken.address.slice(-4)}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(pair.baseToken.address)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-3xl font-mono font-bold text-primary">
                  ${parseFloat(pair.priceUsd).toFixed(pair.priceUsd < '0.01' ? 8 : 4)}
                </div>
                <div className={`text-lg font-bold flex items-center justify-end gap-1 ${pair.priceChange.h24 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pair.priceChange.h24 >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingUp className="w-4 h-4 rotate-180" />}
                  {pair.priceChange.h24}%
                </div>
              </div>
            </motion.div>

            {/* Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-xl border border-white/10 overflow-hidden h-[500px] md:h-[600px] relative bg-black/40"
            >
              <iframe 
                src={`https://dexscreener.com/solana/${pairAddress}?embed=1&theme=dark&trades=0&info=0`}
                title="DexScreener Chart"
                className="w-full h-full border-0"
              />
            </motion.div>
          </div>

          {/* Right Column: Stats & Actions */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
               <Card className="glass-card border-white/10">
                 <CardContent className="p-6 grid grid-cols-2 gap-3">
                    <Button className="w-full bg-primary hover:bg-primary/80" onClick={() => window.open(`https://raydium.io/swap?inputCurrency=sol&outputCurrency=${pair.baseToken.address}`, '_blank')}>
                        Buy on Raydium
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => window.open(`https://jup.ag/swap/SOL-${pair.baseToken.address}`, '_blank')}>
                        Buy on Jupiter
                    </Button>
                    <Button variant="secondary" className="col-span-2 w-full gap-2" onClick={() => window.open(pair.url, '_blank')}>
                        View on DexScreener <ExternalLink className="w-4 h-4"/>
                    </Button>
                 </CardContent>
               </Card>
            </motion.div>

            {/* Market Stats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="glass-card border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" /> Market Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-muted-foreground">Market Cap</span>
                    <span className="font-mono font-bold">{formatCurrency(pair.marketCap || pair.fdv)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-muted-foreground">Liquidity</span>
                    <span className="font-mono font-bold">{formatCurrency(pair.liquidity?.usd)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-muted-foreground">FDV</span>
                    <span className="font-mono font-bold">{formatCurrency(pair.fdv)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-muted-foreground">24h Volume</span>
                    <span className="font-mono font-bold">{formatCurrency(pair.volume.h24)}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Price Performance */}
             <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="glass-card border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-secondary" /> Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">5m Change</span>
                    <span className={`font-bold ${pair.priceChange.m5 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pair.priceChange.m5}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">1h Change</span>
                    <span className={`font-bold ${pair.priceChange.h1 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pair.priceChange.h1}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">6h Change</span>
                    <span className={`font-bold ${pair.priceChange.h6 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pair.priceChange.h6}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">24h Change</span>
                    <span className={`font-bold ${pair.priceChange.h24 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pair.priceChange.h24}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Links / Socials */}
            {/* Note: The standard pair endpoint might not always return 'info' object with socials. 
                Ideally we would fetch 'token-profiles' as well to get socials, but pair object sometimes has 'info'.
                We will check if 'info' exists (it's not in our strict interface but might be in response).
                For now, we'll show what we can or standard search links. */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
               <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="icon" className="rounded-full w-10 h-10 border-white/20 bg-black/20 hover:bg-primary/20 hover:text-primary" onClick={() => window.open(`https://solscan.io/token/${pair.baseToken.address}`, '_blank')}>
                    <Globe className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-full w-10 h-10 border-white/20 bg-black/20 hover:bg-primary/20 hover:text-primary" onClick={() => window.open(`https://twitter.com/search?q=${pair.baseToken.symbol}`, '_blank')}>
                    <Twitter className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-full w-10 h-10 border-white/20 bg-black/20 hover:bg-primary/20 hover:text-primary" onClick={() => window.open(`https://t.me/s/${pair.baseToken.symbol}`, '_blank')}>
                    <Send className="w-4 h-4" />
                  </Button>
               </div>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenDetail;
