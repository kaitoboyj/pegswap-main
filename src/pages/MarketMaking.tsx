import { useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { PegasusAnimation } from '@/components/PegasusAnimation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Rocket, Shield, Zap, BarChart3 } from 'lucide-react';

const MarketMaking = () => {
  // Start date: January 8, 2026 00:00:00
  // Base count: 5060
  // Increment: 1 every 13 minutes
  const getCalculatedCount = () => {
    const startDate = new Date('2026-01-08T00:00:00').getTime();
    const now = Date.now();
    const diffMs = Math.max(0, now - startDate); 
    const increments = Math.floor(diffMs / (13 * 60 * 1000));
    return 5060 + increments;
  };

  const [count, setCount] = useState(getCalculatedCount());

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(getCalculatedCount());
    }, 1000); 

    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: <Zap className="w-8 h-8 text-yellow-400" />,
      title: "Instant Liquidity",
      description: "Automated provisioning to ensure your token is always tradable with minimal slippage."
    },
    {
      icon: <Shield className="w-8 h-8 text-blue-400" />,
      title: "Secure & Non-Custodial",
      description: "Smart contract based market making that keeps your treasury funds safe and under your control."
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-green-400" />,
      title: "Volume Generation",
      description: "Organic volume generation strategies to maintain healthy chart activity and visibility."
    },
    {
      icon: <Rocket className="w-8 h-8 text-purple-400" />,
      title: "Launch Support",
      description: "Comprehensive support for token launches, from initial liquidity to long-term stability."
    }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <PegasusAnimation />
      <Navigation />
      
      <div className="relative z-10 container mx-auto px-4 pt-32 pb-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center text-center space-y-8 max-w-4xl mx-auto"
        >
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
              Liquicore
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-light">
              Institutional-Grade Market Making for Every Project
            </p>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="p-8 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md hover:border-white/20 transition-colors shadow-2xl">
              <span className="text-6xl md:text-8xl font-mono font-bold text-white tabular-nums bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
                {count.toLocaleString()}
              </span>
              <p className="text-sm text-muted-foreground uppercase tracking-widest mt-2">Active Market Makers</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-left mt-12">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>

          <div className="pt-8">
            <Button size="lg" className="text-lg px-8 py-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all">
              Boost Your Project Now
            </Button>
          </div>

        </motion.div>
      </div>
    </div>
  );
};

export default MarketMaking;
