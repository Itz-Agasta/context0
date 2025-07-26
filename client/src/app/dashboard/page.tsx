'use client';
import React, { useEffect, useState } from 'react';
import { Cpu, DollarSign, ShoppingCart, TrendingUp, Bell, Search, Settings, User } from 'lucide-react';
import DashboardNavbar from '@/components/ui/DashboardNavbar';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon }) => (
  <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-800 p-6 hover:shadow-md transition-all duration-300">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-white mt-2">{value}</p>
      </div>
      <div className="p-3 bg-gradient-to-br from-gray-800 to-gray-700 rounded-xl">
        {icon}
      </div>
    </div>
  </div>
);

const base_url = 'https://context0-540193079740.asia-south2.run.app/';
const contract_id = '{contract_id}';

const Dashboard: React.FC = () => {
  const [monthlyData, setMonthlyData] = useState([
    { name: 'Jan', sales: 0, revenue: 0 },
    { name: 'Feb', sales: 0, revenue: 0 },
    { name: 'Mar', sales: 0, revenue: 0 },
    { name: 'Apr', sales: 0, revenue: 0 },
    { name: 'May', sales: 0, revenue: 0 },
    { name: 'Jun', sales: 0, revenue: 0 },
  ]);
  const [stats, setStats] = useState({
    space: '0/1GB',
    requests: '0',
    orders: '0',
    growthRate: '0%',
  });
  const [recentActivities, setRecentActivities] = useState([
    { id: 1, user: '', action: '', time: '', avatar: '' },
  ]);

  useEffect(() => {
    fetch(`${base_url}/admin/memories/${contract_id}`)
      .then(res => res.json())
      .then(data => {
        // Example mapping, adjust according to your API response structure
        setMonthlyData(data.monthlyData || []);
        setStats({
          space: data.space || '0/1GB',
          requests: data.requests || '0',
          orders: data.orders || '0',
          growthRate: data.growthRate || '0%',
        });
        setRecentActivities(data.recentActivities || []);
      })
      .catch(() => {
        // fallback or error handling
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800">
      {/* Use DashboardNavbar instead of FloatingNavbar */}
      <DashboardNavbar />

      {/* Main Content */}
      <div className="flex flex-col">   

        {/* Dashboard Content */}
        <main className="flex-1 p-6 ml-16">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Space"
              value={stats.space}
              icon={<Cpu className="w-6 h-6 text-gray-100" />}
            />
            <StatCard
              title="Requests"
              value={stats.requests}
              icon={<DollarSign className="w-6 h-6 text-gray-100" />}
            />
            <StatCard
              title="Orders"
              value={stats.orders}
              icon={<ShoppingCart className="w-6 h-6 text-gray-100" />}
            />
            <StatCard
              title="Growth Rate"
              value={stats.growthRate}
              icon={<TrendingUp className="w-6 h-6 text-gray-100" />}
            />
          </div>

          {/* Charts Section: Line Chart occupies full width */}
          <div className="mb-8">
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-800 p-6 hover:shadow-md transition-all duration-300 flex flex-col h-full w-full">
              <h3 className="text-lg font-semibold text-gray-100 mb-6">Monthly Sales & Revenue</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="name" stroke="#bbb" />
                  <YAxis stroke="#bbb" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(30, 30, 30, 0.95)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
                    }}
                  />
                  <Line type="monotone" dataKey="sales" stroke="#bbb" strokeWidth={3} dot={{ r: 4 }} name="Sales" />
                  <Line type="monotone" dataKey="revenue" stroke="#888" strokeWidth={3} dot={{ r: 4 }} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-gray-900/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-800 p-6 hover:shadow-md transition-all duration-300 flex flex-col h-full">
              <h3 className="text-lg font-semibold text-gray-100 mb-6">Recent Activity</h3>
              <div className="space-y-4 flex-1">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-800/80 transition-all duration-200">
                    <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full flex items-center justify-center text-xs font-medium text-gray-300 shadow-sm">
                      {activity.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-100">
                        <span className="font-medium">{activity.user}</span> {activity.action}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Add more cards or charts here if needed to fill space */}
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-800 p-6 hover:shadow-md transition-all duration-300 flex flex-col h-full">
              <h3 className="text-lg font-semibold text-gray-100 mb-6">Summary</h3>
              <p className="text-gray-400">Add more dashboard widgets or summaries here to fill the space.</p>
            </div>
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-800 p-6 hover:shadow-md transition-all duration-300 flex flex-col h-full">
              <h3 className="text-lg font-semibold text-gray-100 mb-6">Tips</h3>
              <p className="text-gray-400">You can add tips, news, or other useful info here.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;