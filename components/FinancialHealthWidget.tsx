
import React from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import Card from './Card';
import { FinancialHealthScore } from '../utils';

interface FinancialHealthWidgetProps {
  healthScore: FinancialHealthScore;
  onClick: () => void;
}

const FinancialHealthWidget: React.FC<FinancialHealthWidgetProps> = ({ healthScore, onClick }) => {
  const { score, rank } = healthScore;

  const data = [{ name: 'Score', value: score }];
  
  let color = '#ef4444'; // Red
  if (score >= 80) color = '#22c55e'; // Green
  else if (score >= 60) color = '#3b82f6'; // Blue
  else if (score >= 40) color = '#eab308'; // Yellow

  return (
    <Card className="h-full flex flex-col items-center justify-center cursor-pointer hover:shadow-lg transition-all" onClick={onClick}>
      <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-2">Financial Health</h3>
      
      <div className="relative w-40 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart 
            cx="50%" 
            cy="50%" 
            innerRadius="80%" 
            outerRadius="100%" 
            barSize={10} 
            data={data} 
            startAngle={180} 
            endAngle={0}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background
              dataKey="value"
              cornerRadius={5}
              fill={color}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center -mt-4 pointer-events-none">
             <span className="text-4xl font-bold text-light-text dark:text-dark-text">{score}</span>
             <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider font-semibold">/ 100</span>
        </div>
      </div>
      
      <div className="text-center mt-2">
          <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Rank</p>
          <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{rank}</p>
      </div>
      
      <button className="mt-4 text-xs font-semibold text-primary-500 hover:underline">View Breakdown</button>
    </Card>
  );
};

export default FinancialHealthWidget;
