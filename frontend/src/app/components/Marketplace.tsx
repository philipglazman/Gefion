import { Link } from 'react-router';
import { useApp } from '../context/AppContext';
import { ShoppingCart } from 'lucide-react';

export function Marketplace() {
  const { games } = useApp();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Steam Game Marketplace</h1>
        <p className="text-slate-600">Buy Steam games with USDC on Monad blockchain</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game) => (
          <Link
            key={game.id}
            to={`/game/${game.id}`}
            className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow border border-slate-200"
          >
            <div className="aspect-video overflow-hidden bg-slate-100">
              <img
                src={game.image}
                alt={game.title}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="p-5">
              <h3 className="font-semibold text-lg text-slate-900 mb-2">{game.title}</h3>
              <p className="text-sm text-slate-600 mb-4 line-clamp-2">{game.description}</p>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Seller: {game.seller}</div>
                  <div className="text-2xl font-bold text-blue-600">{game.price} USDC</div>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {games.length === 0 && (
        <div className="text-center py-16">
          <p className="text-slate-500 text-lg">No games available at the moment</p>
        </div>
      )}
    </div>
  );
}
