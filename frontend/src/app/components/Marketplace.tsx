import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useApp } from '../context/AppContext';
import { Gamepad2, ChevronLeft, ChevronRight } from 'lucide-react';

export function Marketplace() {
  const { games } = useApp();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-advance carousel
  useEffect(() => {
    if (games.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % Math.min(games.length, 5));
    }, 5000);
    return () => clearInterval(timer);
  }, [games.length]);

  const featuredGames = games.slice(0, 5);
  const currentGame = featuredGames[currentSlide];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % featuredGames.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + featuredGames.length) % featuredGames.length);
  };

  return (
    <div className="min-h-screen bg-[#121212]">
      {/* Hero Carousel */}
      {games.length > 0 && currentGame && (
        <div className="relative h-[320px] overflow-hidden">
          {/* Background Image with transition */}
          <div className="absolute inset-0">
            {featuredGames.map((game, index) => (
              <div
                key={game.id}
                className={`absolute inset-0 transition-opacity duration-700 ${
                  index === currentSlide ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <img
                  src={game.image}
                  alt={game.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#121212]/90 to-transparent" />
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-8">
            <div className="flex-1 max-w-lg">
              <span className="inline-block px-2 py-0.5 bg-[#0074e4] text-white text-[10px] font-medium rounded mb-2">
                FEATURED
              </span>
              <h1 className="text-2xl font-bold text-white mb-2 line-clamp-1">{currentGame.title}</h1>
              <p className="text-gray-300 text-sm mb-4 line-clamp-2">{currentGame.description}</p>
              <div className="flex items-center gap-3">
                <Link
                  to={`/game/${currentGame.id}`}
                  className="px-5 py-2 bg-[#0074e4] text-white text-sm font-medium rounded hover:bg-[#0066cc] transition-all duration-200"
                >
                  Buy Now - ${currentGame.price}
                </Link>
                <Link
                  to={`/game/${currentGame.id}`}
                  className="px-5 py-2 bg-white/10 text-white text-sm font-medium rounded hover:bg-white/20 transition-all duration-200"
                >
                  View Details
                </Link>
              </div>
            </div>

            {/* Carousel Controls */}
            {featuredGames.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={prevSlide}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <div className="flex gap-1.5">
                  {featuredGames.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        index === currentSlide
                          ? 'w-6 bg-[#0074e4]'
                          : 'w-1.5 bg-white/30 hover:bg-white/50'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={nextSlide}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>
            )}
          </div>

          {/* Thumbnail Strip */}
          {featuredGames.length > 1 && (
            <div className="absolute bottom-4 right-4 hidden lg:flex gap-2">
              {featuredGames.map((game, index) => (
                <button
                  key={game.id}
                  onClick={() => setCurrentSlide(index)}
                  className={`relative w-24 h-14 rounded overflow-hidden transition-all duration-200 ${
                    index === currentSlide
                      ? 'ring-2 ring-[#0074e4] ring-offset-2 ring-offset-[#121212]'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={game.image}
                    alt={game.title}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Games Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Available Games</h2>
          <span className="text-gray-500 text-xs">{games.length} games</span>
        </div>

        {games.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Gamepad2 className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-gray-500">No games available</p>
            <p className="text-gray-600 text-xs mt-1">Check back later for new listings</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {games.map((game) => (
              <Link
                key={game.id}
                to={`/game/${game.id}`}
                className="group bg-[#1a1a1a] rounded overflow-hidden hover:ring-1 hover:ring-white/20 transition-all duration-300 hover:transform hover:scale-[1.02]"
              >
                <div className="aspect-[3/4] overflow-hidden relative">
                  <img
                    src={game.image}
                    alt={game.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="p-2.5">
                  <h3 className="font-medium text-white text-xs mb-0.5 truncate group-hover:text-[#0074e4] transition-colors">
                    {game.title}
                  </h3>
                  <p className="text-[10px] text-gray-500 mb-1.5 truncate">{game.seller}</p>
                  <span className="text-white text-sm font-bold">${game.price}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
