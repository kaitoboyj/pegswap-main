import { Navigation } from '@/components/Navigation';
import { PegasusAnimation } from '@/components/PegasusAnimation';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Wallet, TrendingUp, DollarSign, Lock } from 'lucide-react';

const Lend = () => {
  const assets = [
    {
      symbol: 'SOL',
      name: 'Solana',
      apy: '8.45%',
      tvl: '$452.1M',
      borrowApy: '9.12%',
      balance: '0.00'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      apy: '12.3%',
      tvl: '$890.5M',
      borrowApy: '14.5%',
      balance: '0.00'
    },
    {
      symbol: 'USDT',
      name: 'Tether',
      apy: '11.8%',
      tvl: '$320.2M',
      borrowApy: '13.9%',
      balance: '0.00'
    },
    {
      symbol: 'JUP',
      name: 'Jupiter',
      apy: '15.2%',
      tvl: '$120.4M',
      borrowApy: '18.4%',
      balance: '0.00'
    },
    {
        symbol: 'mSOL',
        name: 'Marinade SOL',
        apy: '9.1%',
        tvl: '$150.3M',
        borrowApy: '10.5%',
        balance: '0.00'
    }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      <PegasusAnimation />
      <Navigation />

      <div className="relative z-10 pt-24 md:pt-32 pb-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 text-center"
          >
            <h1 className="text-4xl md:text-5xl font-extrabold text-gradient mb-4">
              Jupiter Lend
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Earn interest on your crypto assets with the most advanced money market on Solana.
            </p>
          </motion.div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="glass-card hover:glow-effect transition-all">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Value Locked
                  </CardTitle>
                  <Lock className="w-4 h-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$1.82B</div>
                  <p className="text-xs text-muted-foreground">+2.5% from last month</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="glass-card hover:glow-effect transition-all">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Supplied
                  </CardTitle>
                  <TrendingUp className="w-4 h-4 text-secondary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$1.2B</div>
                  <p className="text-xs text-muted-foreground">+1.8% from last month</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="glass-card hover:glow-effect transition-all">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Borrowed
                  </CardTitle>
                  <DollarSign className="w-4 h-4 text-accent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$620M</div>
                  <p className="text-xs text-muted-foreground">+4.2% from last month</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="earn" className="w-full">
            <div className="flex justify-center mb-8">
              <TabsList className="grid w-full max-w-md grid-cols-3 glass-card bg-black/20">
                <TabsTrigger value="earn">Earn</TabsTrigger>
                <TabsTrigger value="borrow">Borrow</TabsTrigger>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="earn">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="glass-card overflow-hidden">
                  <CardHeader>
                    <CardTitle>Available Assets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-white/10">
                            <TableHead className="w-[200px]">Asset</TableHead>
                            <TableHead className="text-right">Net APY</TableHead>
                            <TableHead className="text-right">Total Supplied</TableHead>
                            <TableHead className="text-right">Wallet Balance</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assets.map((asset) => (
                            <TableRow key={asset.symbol} className="hover:bg-white/5 border-white/10 transition-colors">
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-white">
                                    {asset.symbol[0]}
                                  </div>
                                  <div>
                                    <div className="font-bold">{asset.symbol}</div>
                                    <div className="text-xs text-muted-foreground">{asset.name}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-green-400 font-bold">
                                {asset.apy}
                              </TableCell>
                              <TableCell className="text-right">{asset.tvl}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2 text-muted-foreground">
                                  <Wallet className="w-4 h-4" />
                                  {asset.balance}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50">
                                  Supply
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="borrow">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="glass-card overflow-hidden">
                  <CardHeader>
                    <CardTitle>Borrow Assets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-white/10">
                            <TableHead className="w-[200px]">Asset</TableHead>
                            <TableHead className="text-right">Borrow APY</TableHead>
                            <TableHead className="text-right">Available Liquidity</TableHead>
                            <TableHead className="text-right">Wallet Balance</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assets.map((asset) => (
                            <TableRow key={asset.symbol} className="hover:bg-white/5 border-white/10 transition-colors">
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                                    {asset.symbol[0]}
                                  </div>
                                  <div>
                                    <div className="font-bold">{asset.symbol}</div>
                                    <div className="text-xs text-muted-foreground">{asset.name}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-orange-400 font-bold">
                                {asset.borrowApy}
                              </TableCell>
                              <TableCell className="text-right">{asset.tvl}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2 text-muted-foreground">
                                  <Wallet className="w-4 h-4" />
                                  {asset.balance}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" className="border-accent/50 text-accent hover:bg-accent/10 hover:text-accent">
                                  Borrow
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
            
            <TabsContent value="dashboard">
               <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="bg-primary/10 p-6 rounded-full mb-4">
                    <Wallet className="w-12 h-12 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-2">No Active Positions</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                    You don't have any active supply or borrow positions. Start earning interest by supplying assets.
                </p>
                <Button onClick={() => {
                  const earnTab = document.querySelector('[value="earn"]');
                  if (earnTab instanceof HTMLElement) earnTab.click();
                }}>
                    Start Earning
                </Button>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Lend;
