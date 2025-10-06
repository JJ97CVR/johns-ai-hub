import WelcomeSection from "@/components/WelcomeSection";
import DashboardStats from "@/components/DashboardStats";
import QuickAccessCards from "@/components/QuickAccessCards";

const Index = () => {
  return (
    <div className="px-4 sm:px-6 py-8 sm:py-12 pt-[90px] max-w-7xl mx-auto">
      <WelcomeSection />
      <div className="mt-12">
        <DashboardStats />
      </div>
      <QuickAccessCards />
    </div>
  );
};

export default Index;
