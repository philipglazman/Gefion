import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router';
import {
  Lock,
  ShieldCheck,
  BadgeDollarSign,
  Search,
  UserCheck,
  Vault,
  Gift,
  ScanEye,
  CircleDollarSign,
  ListPlus,
  ShoppingCart,
  Send,
  CheckCircle,
  Gamepad2,
  Tag,
} from 'lucide-react';

type Role = 'buyer' | 'seller';

const pillars = [
  {
    icon: Lock,
    title: 'Trustless Escrow',
    description: 'A smart contract holds funds until delivery is verified. No middleman, no counterparty risk.',
    color: '#0074e4',
  },
  {
    icon: ShieldCheck,
    title: 'zkTLS Verified',
    description: 'Cryptographic proof of game ownership using zero-knowledge TLS. No screenshots, no trust.',
    color: '#00d26a',
  },
  {
    icon: BadgeDollarSign,
    title: 'Zero Fees',
    description: 'No platform fees, ever. The price you see is the price you pay — we take nothing.',
    color: '#00b4d8',
  },
];

const buyerSteps = [
  {
    icon: Search,
    title: 'Browse & Pick',
    description: 'Explore the store and find the game you want. Every listing shows the price in USDC and the seller\'s address.',
  },
  {
    icon: UserCheck,
    title: 'Enter Your Steam Username',
    description: 'We check that your Steam profile is public so the seller can gift the game and verification can happen later.',
  },
  {
    icon: Vault,
    title: 'Funds Go to Escrow',
    description: 'Your USDC is locked in a smart contract. The seller can see the funds are secured but can\'t touch them yet.',
  },
  {
    icon: Gift,
    title: 'Seller Gifts the Game',
    description: 'The seller sends the game to your Steam account as a gift. You\'ll see it appear in your library.',
  },
  {
    icon: ScanEye,
    title: 'zkTLS Proves Ownership',
    description: 'A cryptographic proof is generated from Steam\'s own servers, confirming you now own the game. No trust needed.',
  },
  {
    icon: CircleDollarSign,
    title: 'Seller Gets Paid',
    description: 'The smart contract releases funds to the seller. You keep the game. Everyone\'s happy.',
  },
];

const sellerSteps = [
  {
    icon: ListPlus,
    title: 'List Your Game',
    description: 'Enter the Steam App ID and set your price in USDC. Your listing goes live instantly.',
  },
  {
    icon: ShoppingCart,
    title: 'A Buyer Purchases',
    description: 'When someone buys, their USDC is locked in escrow. You\'ll see the order and the buyer\'s Steam username.',
  },
  {
    icon: Send,
    title: 'Gift the Game',
    description: 'Send the game to the buyer as a Steam gift using their username. That\'s the only action you need to take.',
  },
  {
    icon: CheckCircle,
    title: 'Verified & Paid',
    description: 'zkTLS proves the buyer received the game. The escrow releases your funds automatically. Done.',
  },
];

export function About() {
  const [role, setRole] = useState<Role>('buyer');
  const steps = role === 'buyer' ? buyerSteps : sellerSteps;
  const accent = role === 'buyer' ? '#0074e4' : '#00d26a';

  return (
    <div className="bg-[#121212] min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0074e4]/6 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 pt-20 sm:pt-28 pb-10 text-center relative">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0074e4] mb-4"
          >
            How it works
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-5 tracking-tight leading-[1.1]"
          >
            Trade games,<br />
            trust math.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
            className="text-base sm:text-lg text-gray-400 max-w-lg mx-auto leading-relaxed"
          >
            Gefion uses{' '}
            <span className="text-[#00d26a] font-medium">cryptographic proofs</span> and{' '}
            <span className="text-[#0074e4] font-medium">smart-contract escrow</span> so
            buyers and sellers never have to trust each other.
          </motion.p>
        </div>
      </section>

      {/* Pillars */}
      <section className="max-w-3xl mx-auto px-4 pb-20 sm:pb-28">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {pillars.map((pillar, i) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.1 }}
              className="bg-[#1a1a1a] border border-white/5 rounded-xl p-6 text-center"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: `${pillar.color}18` }}
              >
                <pillar.icon className="w-5 h-5" style={{ color: pillar.color }} />
              </div>
              <h2 className="text-sm font-semibold text-white mb-1.5">{pillar.title}</h2>
              <p className="text-xs text-gray-400 leading-relaxed">{pillar.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Role Picker */}
      <section className="max-w-3xl mx-auto px-4 pb-16 sm:pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Which side are you on?
          </h2>
          <p className="text-sm text-gray-400">Pick your role and we'll walk you through it.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
          className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md mx-auto"
        >
          <button
            onClick={() => setRole('buyer')}
            className={`relative group rounded-xl p-5 sm:p-6 text-center transition-all duration-300 border ${
              role === 'buyer'
                ? 'bg-[#0074e4]/10 border-[#0074e4]/40 shadow-[0_0_24px_-6px_rgba(0,116,228,0.25)]'
                : 'bg-[#1a1a1a] border-white/5 hover:border-white/10 hover:bg-[#1f1f1f]'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 transition-colors duration-300 ${
                role === 'buyer' ? 'bg-[#0074e4]/20' : 'bg-white/5 group-hover:bg-white/8'
              }`}
            >
              <Gamepad2
                className={`w-6 h-6 transition-colors duration-300 ${
                  role === 'buyer' ? 'text-[#0074e4]' : 'text-gray-400 group-hover:text-gray-300'
                }`}
              />
            </div>
            <div
              className={`text-sm font-semibold mb-0.5 transition-colors duration-300 ${
                role === 'buyer' ? 'text-white' : 'text-gray-300'
              }`}
            >
              I want to buy
            </div>
            <div className="text-xs text-gray-500">Show me how to get games</div>
          </button>

          <button
            onClick={() => setRole('seller')}
            className={`relative group rounded-xl p-5 sm:p-6 text-center transition-all duration-300 border ${
              role === 'seller'
                ? 'bg-[#00d26a]/10 border-[#00d26a]/40 shadow-[0_0_24px_-6px_rgba(0,210,106,0.25)]'
                : 'bg-[#1a1a1a] border-white/5 hover:border-white/10 hover:bg-[#1f1f1f]'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 transition-colors duration-300 ${
                role === 'seller' ? 'bg-[#00d26a]/20' : 'bg-white/5 group-hover:bg-white/8'
              }`}
            >
              <Tag
                className={`w-6 h-6 transition-colors duration-300 ${
                  role === 'seller' ? 'text-[#00d26a]' : 'text-gray-400 group-hover:text-gray-300'
                }`}
              />
            </div>
            <div
              className={`text-sm font-semibold mb-0.5 transition-colors duration-300 ${
                role === 'seller' ? 'text-white' : 'text-gray-300'
              }`}
            >
              I want to sell
            </div>
            <div className="text-xs text-gray-500">Show me how to earn</div>
          </button>
        </motion.div>
      </section>

      {/* Steps */}
      <section className="max-w-3xl mx-auto px-4 pb-20 sm:pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            {/* Section header */}
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {role === 'buyer' ? 'Buying a game' : 'Selling a game'}
              </h2>
              <p className="text-sm text-gray-400">
                {role === 'buyer'
                  ? `${buyerSteps.length} steps from browsing to playing.`
                  : `${sellerSteps.length} steps from listing to payout.`}
              </p>
            </div>

            {/* Vertical timeline */}
            <div className="relative">
              {/* Timeline line */}
              <div
                className="absolute left-5 sm:left-6 top-0 bottom-0 w-px"
                style={{ backgroundColor: `${accent}20` }}
              />

              <div className="space-y-6 sm:space-y-8">
                {steps.map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.08 }}
                    className="relative flex gap-5 sm:gap-6"
                  >
                    {/* Step number circle */}
                    <div className="relative z-10 shrink-0">
                      <div
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm sm:text-base font-bold"
                        style={{
                          backgroundColor: `${accent}15`,
                          color: accent,
                          boxShadow: `0 0 0 4px #121212`,
                        }}
                      >
                        {i + 1}
                      </div>
                    </div>

                    {/* Step content */}
                    <div className="flex-1 bg-[#1a1a1a] border border-white/5 rounded-xl p-5 sm:p-6 min-w-0">
                      <div className="flex items-center gap-2.5 mb-2">
                        <step.icon className="w-4 h-4 shrink-0" style={{ color: accent }} />
                        <h3 className="text-base sm:text-lg font-semibold text-white">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 pb-24 sm:pb-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="rounded-xl border border-white/5 p-8 sm:p-12 text-center relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${accent}08 0%, #1a1a1a 50%, #1a1a1a 100%)`,
          }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            {role === 'buyer' ? 'Ready to find a deal?' : 'Ready to start earning?'}
          </h2>
          <p className="text-sm sm:text-base text-gray-400 mb-8 max-w-md mx-auto">
            {role === 'buyer'
              ? 'Browse games from sellers around the world. No sign-up required — just connect a wallet.'
              : 'List a game in seconds. No approval process, no fees, no middleman.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to={role === 'buyer' ? '/' : '/seller'}
              className="px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors"
              style={{ backgroundColor: accent }}
            >
              {role === 'buyer' ? 'Browse Store' : 'Start Selling'}
            </Link>
            <Link
              to={role === 'buyer' ? '/seller' : '/'}
              className="px-6 py-2.5 bg-white/8 text-white text-sm font-medium rounded-lg hover:bg-white/12 transition-colors"
            >
              {role === 'buyer' ? 'Or start selling' : 'Or browse games'}
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
