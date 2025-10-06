import { Card } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Package, TrendingUp, ShoppingCart, Truck } from "lucide-react";

// Fiktiv försäljningsdata (senaste 7 dagarna)
const salesData = [
  { dag: "Mån", försäljning: 45000 },
  { dag: "Tis", försäljning: 52000 },
  { dag: "Ons", försäljning: 48000 },
  { dag: "Tor", försäljning: 61000 },
  { dag: "Fre", försäljning: 55000 },
  { dag: "Lör", försäljning: 38000 },
  { dag: "Sön", försäljning: 42000 },
];

// Fiktiv lagerdata (top 5 kategorier)
const inventoryData = [
  { kategori: "Bromsar", antal: 1247 },
  { kategori: "Filter", antal: 2156 },
  { kategori: "Lampor", antal: 856 },
  { kategori: "Oljor", antal: 1543 },
  { kategori: "Batteri", antal: 432 },
];

const DashboardStats = () => {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total försäljning</p>
              <h3 className="mt-2 text-3xl font-bold text-foreground">341 000 kr</h3>
              <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +12.5% från förra veckan
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-database)]">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Artiklar i lager</p>
              <h3 className="mt-2 text-3xl font-bold text-foreground">6 234</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Över 156 kategorier
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-analytics)]">
              <Package className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Skickade order</p>
              <h3 className="mt-2 text-3xl font-bold text-foreground">142</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Denna vecka
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-personal)]">
              <Truck className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Mest sålda artikeln</p>
              <h3 className="mt-2 text-xl font-bold text-foreground">Bromsbelägg X500</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                87 st denna vecka
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-system)]">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sales Chart */}
        <Card className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-foreground">Försäljning senaste veckan</h3>
            <p className="text-sm text-muted-foreground">Daglig försäljning i SEK</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(214 69% 40%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(214 69% 40%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="dag" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => `${value / 1000}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [`${value.toLocaleString()} kr`, "Försäljning"]}
              />
              <Area
                type="monotone"
                dataKey="försäljning"
                stroke="hsl(214 69% 40%)"
                strokeWidth={2}
                fill="url(#colorSales)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Inventory Chart */}
        <Card className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-foreground">Lager per kategori</h3>
            <p className="text-sm text-muted-foreground">Top 5 mest lagrade kategorier</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={inventoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="kategori" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [`${value} st`, "Antal"]}
              />
              <Bar 
                dataKey="antal" 
                fill="hsl(214 69% 40%)" 
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};

export default DashboardStats;
