import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { Marketplace } from "./components/Marketplace";
import { GameDetails } from "./components/GameDetails";
import { BuyerDashboard } from "./components/BuyerDashboard";
import { SellerDashboard } from "./components/SellerDashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: Marketplace },
      { path: "game/:id", Component: GameDetails },
      { path: "buyer", Component: BuyerDashboard },
      { path: "seller", Component: SellerDashboard },
    ],
  },
]);
