
import React from 'react';

interface PageHeaderProps {
  title: string;
  subTitle?: string;
  actions?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subTitle, actions }) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-extrabold text-light-text dark:text-dark-text tracking-tight">{title}</h1>
        {subTitle && <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1 text-sm font-medium">{subTitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-3 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
